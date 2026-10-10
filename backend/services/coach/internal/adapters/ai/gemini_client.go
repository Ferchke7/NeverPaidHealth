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
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type AIProvider interface {
	GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string, lang string) (coach.ChatResponse, error)
	AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string, lang string) (coach.MealAnalysisResult, error)
	AnalyzeMealText(ctx context.Context, description string, lang string) (coach.MealAnalysisResult, error)
}

type CompositeAIProvider struct {
	geminiKey        string
	ruleEngine       *RuleEngineProvider
	httpClient       *http.Client
	discoveredOnce   sync.Once
	cachedModels     []string
	lastWorkingModel string
	modelsMutex      sync.RWMutex
}

func NewCompositeAIProvider() *CompositeAIProvider {
	key := os.Getenv("GEMINI_API_KEY")
	p := &CompositeAIProvider{
		geminiKey:  key,
		ruleEngine: NewRuleEngineProvider(),
		httpClient: &http.Client{Timeout: 40 * time.Second},
	}
	return p
}

func (p *CompositeAIProvider) recordWorkingModel(model string) {
	p.modelsMutex.Lock()
	defer p.modelsMutex.Unlock()
	p.lastWorkingModel = model
}

type listModelsResponse struct {
	Models []struct {
		Name                       string   `json:"name"`
		SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
	} `json:"models"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func (p *CompositeAIProvider) getCandidateModels(ctx context.Context, key string) []string {
	p.modelsMutex.RLock()
	lastWorking := p.lastWorkingModel
	if len(p.cachedModels) > 0 {
		models := make([]string, 0, len(p.cachedModels))
		if lastWorking != "" {
			models = append(models, lastWorking)
		}
		for _, m := range p.cachedModels {
			if m != lastWorking {
				models = append(models, m)
			}
		}
		p.modelsMutex.RUnlock()
		return models
	}
	p.modelsMutex.RUnlock()

	var discovered []string
	p.discoveredOnce.Do(func() {
		if key == "" {
			return
		}
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", key)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			slog.Warn("Failed to create ListModels request", "error", err)
			return
		}

		resp, err := p.httpClient.Do(req)
		if err != nil {
			slog.Warn("ListModels HTTP call failed", "error", err)
			return
		}
		defer func(Body io.ReadCloser) {
			_ = Body.Close()
		}(resp.Body)

		rawBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			slog.Error("Google Gemini ListModels API error", "status", resp.StatusCode, "response", string(rawBody))
			return
		}

		var res listModelsResponse
		if err := json.Unmarshal(rawBody, &res); err != nil {
			slog.Warn("Failed to parse ListModels JSON", "error", err, "raw", string(rawBody))
			return
		}

		if res.Error != nil {
			slog.Error("Google Gemini reported API error in ListModels", "code", res.Error.Code, "message", res.Error.Message)
			return
		}

		// Preferred order: High-speed reasoning & multimodal models
		priorityKeywords := []string{
			"gemini-2.0-flash",
			"gemini-2.0-flash-lite",
			"gemini-1.5-flash",
			"gemini-1.5-pro",
			"gemini-flash-latest",
		}

		var rawValid []string
		for _, m := range res.Models {
			name := strings.TrimPrefix(m.Name, "models/")
			if strings.Contains(name, "tts") ||
				strings.Contains(name, "lyria") ||
				strings.Contains(name, "transcribe") ||
				strings.Contains(name, "clip") ||
				strings.Contains(name, "image") ||
				strings.Contains(name, "embedding") ||
				strings.Contains(name, "banana") ||
				strings.Contains(name, "deep-research") ||
				strings.Contains(name, "antigravity") ||
				strings.Contains(name, "customtools") {
				continue
			}
			if slices.Contains(m.SupportedGenerationMethods, "generateContent") {
				rawValid = append(rawValid, name)
			}
		}

		for _, pref := range priorityKeywords {
			for _, m := range rawValid {
				if m == pref || strings.HasPrefix(m, pref) {
					if !slices.Contains(discovered, m) {
						discovered = append(discovered, m)
					}
				}
			}
		}
		for _, m := range rawValid {
			if !slices.Contains(discovered, m) {
				discovered = append(discovered, m)
			}
		}

		if len(discovered) > 6 {
			discovered = discovered[:6]
		}

		slog.Info("Filtered active multimodal Gemini models", "count", len(discovered), "models", discovered)
	})

	if len(discovered) > 0 {
		p.modelsMutex.Lock()
		p.cachedModels = discovered
		p.modelsMutex.Unlock()
		return discovered
	}

	return []string{
		"gemini-2.0-flash",
		"gemini-2.0-flash-lite",
		"gemini-1.5-flash",
	}
}

func (p *CompositeAIProvider) GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string, lang string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGemini(ctx, req, telemetry, userName, lang)
		if err == nil && res.Reply != "" {
			return res, nil
		}
		slog.Warn("Gemini API call failed, using rule engine fallback", "error", err)
	}

	return p.ruleEngine.GenerateChatResponse(ctx, req, telemetry, userName, lang)
}

func (p *CompositeAIProvider) AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGeminiVision(ctx, imageBase64, mimeType, notes, lang)
		if err == nil && res.MealName != "" {
			return res, nil
		}
		slog.Warn("Gemini Vision meal analysis failed, falling back to rule engine", "error", err)
	}

	if notes != "" {
		return p.ruleEngine.AnalyzeMealText(ctx, notes, lang)
	}
	return p.ruleEngine.AnalyzeMealText(ctx, "Сбалансированное блюдо", lang)
}

func (p *CompositeAIProvider) AnalyzeMealText(ctx context.Context, description string, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGeminiTextNutrition(ctx, description, lang)
		if err == nil && res.MealName != "" {
			return res, nil
		}
		slog.Warn("Gemini Text Nutrition failed, falling back to rule engine", "error", err)
	}

	return p.ruleEngine.AnalyzeMealText(ctx, description, lang)
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
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func formatAthleteProfile(telemetry coach.CoachInsights, userName string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("=== ДОСЬЕ АТЛЕТА (%s) ===\n", userName))

	sb.WriteString(fmt.Sprintf("• Готовность ЦНС: %d/100 (%s)\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
	if telemetry.CurrentWeightKg > 0 {
		sb.WriteString(fmt.Sprintf("• Вес тела: %.1f кг", telemetry.CurrentWeightKg))
		if telemetry.BodyFatPercentage > 0 {
			sb.WriteString(fmt.Sprintf(", Процент жира: %.1f%%", telemetry.BodyFatPercentage))
		}
		if telemetry.BMI > 0 {
			sb.WriteString(fmt.Sprintf(", ИМТ: %.1f", telemetry.BMI))
		}
		sb.WriteString("\n")
	} else {
		sb.WriteString("• Вес тела: еще не записан в профиле\n")
	}
	sb.WriteString(fmt.Sprintf("• Активность за 7 дней: %d тренировок, суммарный тоннаж: %.0f кг\n", telemetry.WeeklyWorkoutsCount, telemetry.WeeklyVolumeKg))
	sb.WriteString(fmt.Sprintf("• Дней с последней тренировки: %d дн.\n", telemetry.DaysSinceLastTrain))
	sb.WriteString(fmt.Sprintf("• Рекомендуемый сплит: %s\n", telemetry.SuggestedSplit))

	sb.WriteString("\n=== СОХРАНЕННЫЕ ПРОГРАММЫ / ЗАНЯТИЯ АТЛЕТА ===\n")
	if len(telemetry.UserRoutines) > 0 {
		for i, r := range telemetry.UserRoutines {
			exList := "без упражнений"
			if len(r.Exercises) > 0 {
				exList = strings.Join(r.Exercises, ", ")
			}
			notes := ""
			if r.Notes != "" {
				notes = fmt.Sprintf(" (%s)", r.Notes)
			}
			sb.WriteString(fmt.Sprintf("%d. Программа: «%s»%s -> Упражнения: [%s]\n", i+1, r.Name, notes, exList))
		}
	} else {
		sb.WriteString("Сохраненных шаблонов программ пока нет.\n")
	}

	sb.WriteString("\n=== ЛИЧНЫЕ РЕКОРДЫ АТЛЕТА (PRs & 1RM) ===\n")
	prs := telemetry.AllTimePRs
	if len(prs) == 0 {
		prs = telemetry.RecentTopPRs
	}
	if len(prs) > 0 {
		for _, pr := range prs {
			oneRMStr := ""
			if pr.Estimated1RM > 0 {
				oneRMStr = fmt.Sprintf(" (расчетный 1RM: %.1f кг)", pr.Estimated1RM)
			}
			dateStr := ""
			if !pr.AchievedAt.IsZero() {
				dateStr = fmt.Sprintf(" [%s]", pr.AchievedAt.Format("02.01.2006"))
			}
			sb.WriteString(fmt.Sprintf("• %s: %.1f кг %s%s%s\n", pr.ExerciseName, pr.Value, pr.PRType, oneRMStr, dateStr))
		}
	} else {
		sb.WriteString("Зафиксированных личных рекордов пока нет.\n")
	}

	sb.WriteString("\n=== ПОСЛЕДНИЕ ЗАВЕРШЕННЫЕ ТРЕНИРОВКИ ===\n")
	if len(telemetry.RecentWorkouts) > 0 {
		for i, w := range telemetry.RecentWorkouts {
			dateStr := w.StartedAt.Format("02.01 15:04")
			sb.WriteString(fmt.Sprintf("%d. «%s» (%s) - Тоннаж: %.0f кг, %d подходов, %d мин. Выполнено: %s\n",
				i+1, w.Name, dateStr, w.TotalVolumeKg, w.CompletedSets, w.DurationMinutes, w.ExerciseSummary))
		}
	} else {
		sb.WriteString("Завершенных тренировок в базе пока нет.\n")
	}

	sb.WriteString("\n=== СЕГОДНЯШНЕЕ ПИТАНИЕ ===\n")
	if telemetry.TodayCalories > 0 {
		sb.WriteString(fmt.Sprintf("Суммарно за сегодня: %d ккал | Белки: %.1f г\n", telemetry.TodayCalories, telemetry.TodayProteinG))
		if len(telemetry.TodayMeals) > 0 {
			sb.WriteString("Приемы пищи:\n")
			for _, m := range telemetry.TodayMeals {
				tStr := ""
				if m.Time != "" {
					tStr = fmt.Sprintf(" (%s)", m.Time)
				}
				sb.WriteString(fmt.Sprintf("• %s%s: %d ккал, Б: %.1fг, У: %.1fг, Ж: %.1fг\n", m.Name, tStr, m.Calories, m.ProteinG, m.CarbsG, m.FatG))
			}
		}
	} else {
		sb.WriteString("Сегодня приемы пищи еще не внесены.\n")
	}

	if len(telemetry.OverloadTargets) > 0 {
		sb.WriteString("\n=== ЦЕЛИ ПРОГРЕССИВНОЙ ПЕРЕГРУЗКИ ===\n")
		for _, t := range telemetry.OverloadTargets {
			sb.WriteString(fmt.Sprintf("• %s: было %.1fкг × %d -> цель: %.1fкг × %d (%s)\n",
				t.ExerciseName, t.LastBestWeight, t.LastBestReps, t.TargetWeightKg, t.TargetReps, t.Recommendation))
		}
	}

	if len(telemetry.GapsAndWeaknesses) > 0 || len(telemetry.PlateauAlerts) > 0 {
		sb.WriteString("\n=== ВЫЯВЛЕННЫЕ ПРОБЕЛЫ И ЗОНЫ РОСТА ===\n")
		for _, g := range telemetry.GapsAndWeaknesses {
			sb.WriteString(fmt.Sprintf("⚠️ %s\n", g))
		}
		for _, p := range telemetry.PlateauAlerts {
			sb.WriteString(fmt.Sprintf("⚠️ Плато в упражнении «%s» (%d дн. без роста, 1RM: %.1fкг): %s\n",
				p.ExerciseName, p.StagnantDays, p.Current1RM, p.Advice))
		}
	}

	return sb.String()
}

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName, lang string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini api key is empty")
	}

	profileDossier := formatAthleteProfile(telemetry, userName)

	langInstruction := "Отвечай на чистом русском языке."
	if lang == "uz" {
		langInstruction = "Javobni FAQAT O'zbek tilida (Lotin alifbosida), professional va motivatsion sport murabbiyi sifatida yoz."
	} else if lang == "en" {
		langInstruction = "Answer strictly in English as a high-performance strength and nutrition coach."
	}

	systemPrompt := fmt.Sprintf(`Ты — элитный персональный ИИ-тренер и спортивный нутрициолог атлета на платформе duda.uz.
Твоя главная миссия — непрерывно улучшать спортивные результаты атлета, преодолевать плато, грамотно дозировать прогрессивную перегрузку (progressive overload), контролировать питание и восстановление.

%s

КЛЮЧЕВЫЕ ПРАВИЛА И СТИЛЬ ОТВЕТА (SOTA AI PRODUCT GUIDELINES):
1. КРАТКОСТЬ И ВЫСОКАЯ ПЛОТНОСТЬ ИНФОРМАЦИИ:
   - Объем ответа: 50–90 слов.
   - Сразу отвечай по существу без банальных водянистых вступлений («Привет! Как твой день?», «Я твой ИИ-тренер»).
2. ИСПОЛЬЗУЙ РЕАЛЬНЫЕ ДАННЫЕ ИЗ ДОСЬЕ АТЛЕТА:
   - Называй точные цифры, упражнения, веса и даты из ДОСЬЕ выше.
   - Если данных еще нет в базе, прямо скажи об этом и порекомендуй зафиксировать.
3. ЯЗЫК:
   %s
4. ЕСЛИ ПРИКРЕПЛЕНО ФОТО:
   - Еда: четко назови блюдо, порцию, КБЖУ и спортивный совет.
   - Форма/техника: 1-2 конкретных замечания по биомеханике/пропорциям.`,
		profileDossier, langInstruction)

	contents := make([]geminiContent, 0)
	history := req.History
	if len(history) > 6 {
		history = history[len(history)-6:]
	}
	for _, h := range history {
		role := "user"
		if h.Role == "coach" {
			role = "model"
		}
		parts := make([]geminiPart, 0)
		if p := createInlineDataPart(h.ImageBase64, h.MimeType); p != nil {
			parts = append(parts, *p)
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
	if p := createInlineDataPart(req.ImageBase64, req.MimeType); p != nil {
		userParts = append(userParts, *p)
	}
	userText := req.Message
	if userText == "" && req.ImageBase64 != "" {
		userText = "Оцени мое фото и дай четкие спортивные рекомендации."
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

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 8*time.Second, "Chat")
	if err != nil {
		return coach.ChatResponse{}, err
	}

	reply := extractCandidateText(geminiResp)
	if reply == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini returned empty response")
	}

	sugg1, sugg2, sugg3 := "Что тренировать сегодня?", "Сколько белка нужно в день?", "Как преодолеть плато?"
	if lang == "uz" {
		sugg1, sugg2, sugg3 = "Bugun nima mashq qilamiz?", "Kunlik oqsil me'yori qancha?", "Natijalarimni tahlil qil"
	} else if lang == "en" {
		sugg1, sugg2, sugg3 = "What should I train today?", "How much protein do I need?", "How to break plateaus?"
	}

	return coach.ChatResponse{
		Reply: strings.TrimSpace(reply),
		Suggestions: []string{
			sugg1,
			sugg2,
			sugg3,
		},
	}, nil
}

func (p *CompositeAIProvider) callGeminiTextNutrition(ctx context.Context, description, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.MealAnalysisResult{}, fmt.Errorf("gemini api key is not configured")
	}

	langTarget := "Russian"
	if lang == "uz" {
		langTarget = "Uzbek (Latin script)"
	} else if lang == "en" {
		langTarget = "English"
	}

	prompt := fmt.Sprintf(`You are an elite AI sports nutritionist and precision nutrition calculation engine for the NeverPaidHealth (duda.uz) fitness ecosystem.
Analyze the user's meal description and return STRICTLY valid JSON without code fences or extra text.

Target Language: %s. All string fields ("meal_name", item "name", "visual_description", "advice") MUST be written in %s.

Rules for precision macro calculation:
1. Parse every food component and estimate portion weights in grams.
2. Standard defaults if not explicitly stated:
   - 1 whole egg: ~55g, 75 kcal, 6.5g P, 0.5g C, 5g F
   - 1 standard chicken breast portion: ~150g, 248 kcal, 46.5g P, 0g C, 5.4g F
   - 1 portion cooked rice/buckwheat/pasta: ~150g, 165-195 kcal, 4-5g P, 35-43g C, 1g F
   - 1 scoop whey protein: ~30g powder, 120-140 kcal, 24-26g P
   - 1 standard banana: ~120g, 105 kcal, 1.3g P, 27g C, 0.3g F
   - Traditional Central Asian dishes:
     - Uzbek Plov: ~320g, 680 kcal, 28g P, 76g C, 29g F
     - Samsa: ~160g, 420 kcal, 16g P, 38g C, 24g F
     - Manti (4 pcs): ~280g, 540 kcal, 24g P, 52g C, 26g F
     - Tandir Flatbread (1/2 non): ~150g, 390 kcal, 11g P, 76g C, 3g F
3. Calculate exact total calories, total protein (g), carbs (g), and fat (g).
4. Give a practical 1-2 sentence evidence-based athlete advice.

User Meal Description:
"%s"

Required JSON Structure:
{
  "meal_name": "string",
  "visual_description": "string",
  "items": [
    {
      "name": "string",
      "portion": "string (e.g. 150g)",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "confidence": "high" | "medium" | "low",
  "health_score": number,
  "advice": "string"
}`, langTarget, langTarget, description)

	payload := geminiRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: prompt},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 7*time.Second, "TextNutrition")
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	return parseMealAnalysisJSON(extractCandidateText(geminiResp))
}

func (p *CompositeAIProvider) callGeminiVision(ctx context.Context, imageBase64, mimeType, notes, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.MealAnalysisResult{}, fmt.Errorf("gemini api key is not configured")
	}

	imgPart := createInlineDataPart(imageBase64, mimeType)
	if imgPart == nil {
		return coach.MealAnalysisResult{}, fmt.Errorf("empty image data for vision analysis")
	}

	langTarget := "Russian"
	if lang == "uz" {
		langTarget = "Uzbek (Latin script)"
	} else if lang == "en" {
		langTarget = "English"
	}

	prompt := fmt.Sprintf(`You are an elite AI sports nutritionist and computer vision food recognition expert.
Analyze this meal/food photo carefully:
1. Identify the specific dish or food item.
2. In "visual_description", explain in detail what you see in the photo (visual texture, shape, color, container/packaging, estimated weight in grams).
3. Break down the detected ingredients with portion weights in grams.
4. Calculate total calories (kcal), protein (g), carbohydrates (g), and fat (g).
5. Give practical nutritional advice for an athlete.
6. Target Language: %s. All string fields ("meal_name", item "name", "visual_description", "advice") MUST be in %s.
7. Return STRICTLY valid JSON without markdown code blocks, backticks, or other text.

Format:
{
  "meal_name": "string",
  "visual_description": "string",
  "items": [
    {"name": "string", "portion": "230g", "calories": 590, "protein_g": 18.0, "carbs_g": 115.0, "fat_g": 5.0}
  ],
  "total_calories": 590,
  "total_protein_g": 18.0,
  "total_carbs_g": 115.0,
  "total_fat_g": 5.0,
  "confidence": "high",
  "health_score": 8,
  "advice": "string"
}`, langTarget, langTarget)

	if notes != "" {
		prompt += fmt.Sprintf("\nUser context note: %s", notes)
	}

	payload := geminiRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: prompt},
					*imgPart,
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 8*time.Second, "VisionNutrition")
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	return parseMealAnalysisJSON(extractCandidateText(geminiResp))
}

func createInlineDataPart(imageBase64, mimeType string) *geminiPart {
	clean := strings.TrimSpace(imageBase64)
	if clean == "" {
		return nil
	}
	mime := mimeType
	if mime == "" {
		mime = "image/jpeg"
	}
	if idx := strings.Index(clean, ","); idx != -1 {
		clean = clean[idx+1:]
	}
	return &geminiPart{
		InlineData: &geminiInlineData{
			MimeType: mime,
			Data:     clean,
		},
	}
}

func (p *CompositeAIProvider) executeGenerateContent(ctx context.Context, key string, bodyBytes []byte, timeout time.Duration, logTag string) (*geminiResponse, error) {
	models := p.getCandidateModels(ctx, key)
	var lastErr error

	for _, model := range models {
		apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, key)
		reqCtx, cancel := context.WithTimeout(ctx, timeout)
		httpReq, err := http.NewRequestWithContext(reqCtx, "POST", apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			cancel()
			lastErr = err
			continue
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			cancel()
			lastErr = err
			continue
		}

		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		cancel()

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("model %s returned %d: %s", model, resp.StatusCode, string(raw))
			slog.Warn("Gemini model candidate failed, trying next", "tag", logTag, "model", model, "status", resp.StatusCode)
			continue
		}

		var geminiResp geminiResponse
		if err := json.Unmarshal(raw, &geminiResp); err != nil {
			lastErr = err
			continue
		}

		p.recordWorkingModel(model)
		return &geminiResp, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("no gemini model candidate succeeded for %s", logTag)
}

func extractCandidateText(resp *geminiResponse) string {
	if resp == nil {
		return ""
	}
	var rawText string
	for _, cand := range resp.Candidates {
		for _, part := range cand.Content.Parts {
			if part.Text != "" {
				rawText += part.Text
			}
		}
	}
	return strings.TrimSpace(rawText)
}

func extractJSON(rawText string) (string, error) {
	trimmed := strings.TrimSpace(rawText)
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start == -1 || end == -1 || end <= start {
		return "", fmt.Errorf("could not find JSON object in response: %s", rawText)
	}
	return trimmed[start : end+1], nil
}

func parseMealAnalysisJSON(rawText string) (coach.MealAnalysisResult, error) {
	jsonStr, err := extractJSON(rawText)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}
	var analysis coach.MealAnalysisResult
	if err := json.Unmarshal([]byte(jsonStr), &analysis); err != nil {
		return coach.MealAnalysisResult{}, fmt.Errorf("failed to parse meal json (%w): %s", err, jsonStr)
	}
	if analysis.TotalCalories == 0 && len(analysis.Items) > 0 {
		for _, item := range analysis.Items {
			analysis.TotalCalories += item.Calories
			analysis.TotalProteinG += item.ProteinG
			analysis.TotalCarbsG += item.CarbsG
			analysis.TotalFatG += item.FatG
		}
	}
	return analysis, nil
}

func (p *CompositeAIProvider) getAPIKey() string {
	if k := os.Getenv("GEMINI_API_KEY"); k != "" {
		return k
	}
	return p.geminiKey
}
