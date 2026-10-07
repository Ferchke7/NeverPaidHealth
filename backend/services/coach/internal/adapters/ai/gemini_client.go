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
		httpClient: &http.Client{Timeout: 25 * time.Second},
	}
}

func (p *CompositeAIProvider) GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	if p.geminiKey != "" {
		res, err := p.callGemini(ctx, req, telemetry, userName)
		if err == nil && res.Reply != "" {
			return res, nil
		}
		slog.Warn("Gemini API call failed, falling back to sports science rule engine", "error", err)
	} else {
		slog.Info("GEMINI_API_KEY not provided, using built-in sports science engine")
	}

	return p.ruleEngine.GenerateChatResponse(ctx, req, telemetry, userName)
}

func (p *CompositeAIProvider) AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string) (coach.MealAnalysisResult, error) {
	if p.geminiKey != "" {
		res, err := p.callGeminiVision(ctx, imageBase64, mimeType, notes)
		if err == nil && res.MealName != "" {
			return res, nil
		}
		slog.Warn("Gemini Vision meal analysis failed, falling back to rule engine", "error", err)
	}

	return p.ruleEngine.AnalyzeMealPhoto(ctx, notes)
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

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	modelName := os.Getenv("GEMINI_MODEL")
	if modelName == "" {
		modelName = "gemini-1.5-flash"
	}
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, p.geminiKey)

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

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return coach.ChatResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return coach.ChatResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return coach.ChatResponse{}, fmt.Errorf("gemini api error %d: %s", resp.StatusCode, string(raw))
	}

	var geminiResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return coach.ChatResponse{}, err
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

	return coach.ChatResponse{}, fmt.Errorf("empty gemini response")
}

func (p *CompositeAIProvider) callGeminiVision(ctx context.Context, imageBase64, mimeType, notes string) (coach.MealAnalysisResult, error) {
	modelName := os.Getenv("GEMINI_MODEL")
	if modelName == "" {
		modelName = "gemini-1.5-flash"
	}
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, p.geminiKey)

	// Clean base64 data prefix if present (e.g. data:image/jpeg;base64,...)
	cleanBase64 := imageBase64
	if idx := strings.Index(imageBase64, ","); idx != -1 {
		cleanBase64 = imageBase64[idx+1:]
	}
	cleanBase64 = strings.TrimSpace(cleanBase64)

	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	prompt := `You are an elite AI sports nutritionist and computer vision meal analyst.
Analyze this meal photo carefully.
1. Identify all food items, ingredients, and approximate portion weights in grams on the plate.
2. Estimate total calories (kcal), protein (g), carbohydrates (g), and fat (g).
3. Return STRICTLY valid JSON without markdown code blocks, backticks, or extra text.

Format:
{
  "meal_name": "Grilled Chicken Breast with Jasmine Rice & Broccoli",
  "items": [
    {"name": "Grilled Chicken Breast", "portion": "200g", "calories": 330, "protein_g": 62.0, "carbs_g": 0.0, "fat_g": 7.0},
    {"name": "Cooked Jasmine Rice", "portion": "180g", "calories": 234, "protein_g": 4.5, "carbs_g": 52.0, "fat_g": 0.5},
    {"name": "Steamed Broccoli", "portion": "100g", "calories": 35, "protein_g": 2.5, "carbs_g": 7.0, "fat_g": 0.4}
  ],
  "total_calories": 599,
  "total_protein_g": 69.0,
  "total_carbs_g": 59.0,
  "total_fat_g": 7.9,
  "confidence": "high",
  "health_score": 9,
  "advice": "High-protein meal with lean macros, ideal for muscle hypertrophy and clean recovery."
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

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return coach.MealAnalysisResult{}, fmt.Errorf("gemini vision error %d: %s", resp.StatusCode, string(raw))
	}

	var geminiResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return coach.MealAnalysisResult{}, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return coach.MealAnalysisResult{}, fmt.Errorf("empty vision response")
	}

	rawText := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	// Strip ```json and ``` if returned by model
	rawText = strings.TrimPrefix(rawText, "```json")
	rawText = strings.TrimPrefix(rawText, "```")
	rawText = strings.TrimSuffix(rawText, "```")
	rawText = strings.TrimSpace(rawText)

	var analysis coach.MealAnalysisResult
	if err := json.Unmarshal([]byte(rawText), &analysis); err != nil {
		return coach.MealAnalysisResult{}, fmt.Errorf("failed to parse vision json: %w (raw: %s)", err, rawText)
	}

	return analysis, nil
}
