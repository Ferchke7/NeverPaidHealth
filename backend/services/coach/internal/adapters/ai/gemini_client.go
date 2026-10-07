package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type AIProvider interface {
	GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error)
	AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string) (coach.MealAnalysisResult, error)
}

type CompositeAIProvider struct {
	geminiKey  string
	ruleEngine *RuleEngineProvider
	httpClient *http.Client
}

func NewCompositeAIProvider() *CompositeAIProvider {
	key := os.Getenv("GEMINI_API_KEY")
	return &CompositeAIProvider{
		geminiKey:  key,
		ruleEngine: NewRuleEngineProvider(),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *CompositeAIProvider) GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGemini(ctx, req, telemetry, userName)
		if err == nil && res.Reply != "" {
			return res, nil
		}
		slog.Warn("Gemini API call failed", "error", err)
	} else {
		slog.Info("GEMINI_API_KEY not configured")
	}

	// When user attached a photo, DO NOT fake or return canned templates
	if req.ImageBase64 != "" {
		return coach.ChatResponse{
			Reply: "⚠️ **ИИ-анализ изображений сейчас недоступен** (Gemini Vision API не подключен или временно не отвечает).\n\nЧтобы не давать неточных оценок вслепую, я не могу проанализировать фото без активного сервиса компьютерного зрения. Вы можете задать любой текстовый вопрос по тренировкам, упражнениям или питанию!",
			Suggestions: []string{
				"Что тренировать сегодня?",
				"Как прогрессировать в жиме?",
				"Сколько белка принимать в день?",
			},
		}, nil
	}

	// Text messages: return evidence-based sports science response with transparent indicator
	return p.ruleEngine.GenerateChatResponse(ctx, req, telemetry, userName)
}

func (p *CompositeAIProvider) AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGeminiVision(ctx, imageBase64, mimeType, notes)
		if err == nil && res.MealName != "" {
			return res, nil
		}
		slog.Warn("Gemini Vision meal analysis failed", "error", err)
		return coach.MealAnalysisResult{}, fmt.Errorf("AI_UNAVAILABLE: Сервис распознавания фото временно недоступен (%v). Введите данные блюда вручную.", err)
	}

	slog.Info("GEMINI_API_KEY not configured for meal photo analysis")
	return coach.MealAnalysisResult{}, fmt.Errorf("AI_UNAVAILABLE: ИИ-распознавание фото недоступно (на сервере не настроен GEMINI_API_KEY). Заполните данные блюда вручную.")
}

type geminiRequest struct {
	Contents          []geminiContent `json:"contents"`
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inline_data,omitempty"`
}

type geminiInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func getCandidateModels() []string {
	configured := os.Getenv("GEMINI_MODEL")
	models := []string{}
	if configured != "" {
		models = append(models, configured)
	}
	defaults := []string{
		"gemini-3.8-flash",
		"gemini-2.5-flash",
		"gemini-1.5-flash",
		"gemini-1.5-pro",
		"gemini-pro",
	}
	for _, m := range defaults {
		if m != configured {
			models = append(models, m)
		}
	}
	return models
}

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini api key is empty")
	}

	bodyStats := "Body Weight: Not logged yet"
	if telemetry.CurrentWeightKg > 0 {
		bodyStats = fmt.Sprintf("Body Weight: %.1f kg", telemetry.CurrentWeightKg)
		if telemetry.BodyFatPercentage > 0 {
			bodyStats += fmt.Sprintf(", Body Fat: %.1f%%", telemetry.BodyFatPercentage)
		}
		if telemetry.BMI > 0 {
			bodyStats += fmt.Sprintf(", BMI: %.1f", telemetry.BMI)
		}
	}

	nutritionStats := "Today's Nutrition: None logged yet"
	if telemetry.TodayCalories > 0 {
		nutritionStats = fmt.Sprintf("Today's Nutrition: %d kcal (Protein: %.1f g)", telemetry.TodayCalories, telemetry.TodayProteinG)
	}

	systemPrompt := fmt.Sprintf(`You are duda.uz AI Coach — an elite, evidence-based strength & conditioning coach and sports scientist.
The user is named %s.

Current User Profile & Telemetry:
- %s
- %s
- Readiness Score: %d/100 (%s)
- Weekly Workouts: %d
- Weekly Total Tonnage: %.1f kg
- Days Since Last Workout: %d
- Suggested Split: %s
- Top Overload Recommendations: %v
- Active Plateau Alerts: %v
- Recent Top PRs: %v

Guidelines:
- Give concise, motivating, highly actionable, and scientific fitness & nutrition advice.
- Always factor in the user's current body weight and protein intake when giving training or nutrition recommendations.
- Answer in the same language as the user (Russian if user asks in Russian, Uzbek if user asks in Uzbek, English if user asks in English).
- Focus on progressive overload, recovery, biomechanics, macros, and periodization.
- When the user sends a photo (physique/body check, posture, form evaluation, progress picture):
  1. Provide a professional, encouraging, and honest assessment of their physique, conditioning, posture, and muscular symmetry (chest, shoulders, back, arms, core, legs).
  2. Estimate body composition & approximate body fat percentage range if visible.
  3. Highlight key strengths and standout muscle groups.
  4. Identify lagging muscle groups or areas to prioritize with specific exercise selections and weekly volume.
  5. Give concrete recommendations on nutrition (calorie surplus/deficit, protein target in grams) and training adjustments.`,
		userName, bodyStats, nutritionStats, telemetry.ReadinessScore, telemetry.RecoveryStatus, telemetry.WeeklyWorkoutsCount,
		telemetry.WeeklyVolumeKg, telemetry.DaysSinceLastTrain, telemetry.SuggestedSplit,
		telemetry.OverloadTargets, telemetry.PlateauAlerts, telemetry.RecentTopPRs)

	contents := make([]geminiContent, 0)
	for _, h := range req.History {
		role := "user"
		if h.Role == "coach" {
			role = "model"
		}
		parts := make([]geminiPart, 0)
		if h.ImageBase64 != "" {
			mime := h.MimeType
			if mime == "" {
				mime = "image/jpeg"
			}
			data := h.ImageBase64
			if idx := strings.Index(data, ","); idx != -1 {
				data = data[idx+1:]
			}
			parts = append(parts, geminiPart{
				InlineData: &geminiInlineData{
					MimeType: mime,
					Data:     data,
				},
			})
		}
		if h.Content != "" {
			parts = append(parts, geminiPart{Text: h.Content})
		}
		if len(parts) > 0 {
			contents = append(contents, geminiContent{
				Role:  role,
				Parts: parts,
			})
		}
	}

	userParts := make([]geminiPart, 0)
	if req.ImageBase64 != "" {
		mime := req.MimeType
		if mime == "" {
			mime = "image/jpeg"
		}
		data := req.ImageBase64
		if idx := strings.Index(data, ","); idx != -1 {
			data = data[idx+1:]
		}
		userParts = append(userParts, geminiPart{
			InlineData: &geminiInlineData{
				MimeType: mime,
				Data:     data,
			},
		})
	}
	userText := req.Message
	if userText == "" && req.ImageBase64 != "" {
		userText = "Оцени мою форму и телосложение, дай честную оценку и рекомендации по тренировкам и питанию."
	}
	if userText != "" {
		userParts = append(userParts, geminiPart{Text: userText})
	}
	if len(userParts) > 0 {
		contents = append(contents, geminiContent{
			Role:  "user",
			Parts: userParts,
		})
	}

	payload := geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: contents,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.ChatResponse{}, err
	}

	var lastErr error
	models := getCandidateModels()

	for _, model := range models {
		apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, key)
		httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			lastErr = err
			continue
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode != http.StatusOK {
			raw, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("model %s returned %d: %s", model, resp.StatusCode, string(raw))
			slog.Warn("Gemini model candidate failed, trying next", "model", model, "status", resp.StatusCode)
			continue
		}

		var geminiResp geminiResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&geminiResp)
		resp.Body.Close()
		if decodeErr != nil {
			lastErr = decodeErr
			continue
		}

		if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
			reply := geminiResp.Candidates[0].Content.Parts[0].Text
			return coach.ChatResponse{
				Reply: strings.TrimSpace(reply),
				Suggestions: []string{
					"Прогрессивная перегрузка для жима лежа",
					"Что тренировать сегодня?",
					"Оптимальное восстановление",
				},
			}, nil
		}
	}

	if lastErr != nil {
		return coach.ChatResponse{}, lastErr
	}
	return coach.ChatResponse{}, fmt.Errorf("no gemini model candidate succeeded")
}

func (p *CompositeAIProvider) getAPIKey() string {
	if k := os.Getenv("GEMINI_API_KEY"); k != "" {
		return k
	}
	return p.geminiKey
}

func (p *CompositeAIProvider) callGeminiVision(ctx context.Context, imageBase64, mimeType, notes string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.MealAnalysisResult{}, fmt.Errorf("gemini api key is not configured")
	}

	// Clean base64 data prefix if present (e.g. data:image/jpeg;base64,...)
	cleanBase64 := imageBase64
	if idx := strings.Index(imageBase64, ","); idx != -1 {
		cleanBase64 = imageBase64[idx+1:]
	}
	cleanBase64 = strings.TrimSpace(cleanBase64)

	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	prompt := `You are an elite AI sports nutritionist and computer vision food recognition expert.
Analyze this meal/food photo carefully:
1. Identify the specific dish or food item (e.g. "Узбекская тандырная лепешка / выпечка в пакете", "Куриное филе с рисом и овощами", "Самса с мясом", "Овсянка с протеином и ягодами", "Стейк из говядины с картофелем", etc.).
2. In "visual_description", explain in detail in Russian what you see in the photo (visual texture, shape, color, container/packaging, estimated size in cm and weight in grams).
3. Break down the detected ingredients with portion weights in grams.
4. Calculate total calories (kcal), protein (g), carbohydrates (g), and fat (g).
5. Give practical nutritional advice for an athlete.
6. Return STRICTLY valid JSON without markdown code blocks, backticks, or other text.

Format:
{
  "meal_name": "Тандырная лепешка / Выпечка в пакете",
  "visual_description": "Круглая румяная пшеничная выпечка / узбекская лепешка в прозрачном целлофановом пакете, диаметр ~18-20 см, примерный вес ~220-250 г.",
  "items": [
    {"name": "Пшеничная выпечка / лепешка", "portion": "230g", "calories": 590, "protein_g": 18.0, "carbs_g": 115.0, "fat_g": 5.0}
  ],
  "total_calories": 590,
  "total_protein_g": 18.0,
  "total_carbs_g": 115.0,
  "total_fat_g": 5.0,
  "confidence": "high",
  "health_score": 7,
  "advice": "Высокоуглеводный продукт с высоким гликемическим индексом. Идеален перед тяжелой силовой тренировкой или для закрытия углеводного окна."
}`

	if notes != "" {
		prompt += fmt.Sprintf("\nUser context note: %s", notes)
	}

	payload := geminiRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: prompt},
					{
						InlineData: &geminiInlineData{
							MimeType: mimeType,
							Data:     cleanBase64,
						},
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	var lastErr error
	models := getCandidateModels()

	for _, model := range models {
		apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, key)
		httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			lastErr = err
			continue
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode != http.StatusOK {
			raw, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("model %s returned %d: %s", model, resp.StatusCode, string(raw))
			slog.Warn("Gemini Vision model candidate failed, trying next", "model", model, "status", resp.StatusCode)
			continue
		}

		var geminiResp geminiResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&geminiResp)
		resp.Body.Close()
		if decodeErr != nil {
			lastErr = decodeErr
			continue
		}

		if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
			lastErr = fmt.Errorf("empty vision response from model %s", model)
			continue
		}

		rawText := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
		rawText = strings.TrimPrefix(rawText, "```json")
		rawText = strings.TrimPrefix(rawText, "```")
		rawText = strings.TrimSuffix(rawText, "```")
		rawText = strings.TrimSpace(rawText)

		var analysis coach.MealAnalysisResult
		if err := json.Unmarshal([]byte(rawText), &analysis); err != nil {
			lastErr = fmt.Errorf("failed to parse vision json: %w (raw: %s)", err, rawText)
			continue
		}

		return analysis, nil
	}

	if lastErr != nil {
		return coach.MealAnalysisResult{}, lastErr
	}
	return coach.MealAnalysisResult{}, fmt.Errorf("no gemini vision model candidate succeeded")
}
