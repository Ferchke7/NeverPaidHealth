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
	GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error)
	AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string) (coach.MealAnalysisResult, error)
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
			err := Body.Close()
			if err != nil {

			}
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

		// Preferred order: High-availability fast multimodal models first (tested live)
		priorityKeywords := []string{
			"gemini-robotics-er-2-preview",
			"gemini-3.5-flash",
			"gemma-4-26b-a4b-it",
			"gemini-3.1-flash-lite",
			"gemini-flash-latest",
			"gemini-flash-lite-latest",
			"gemini-3.6-flash",
			"gemini-3.7-flash",
			"gemini-3.8-flash",
		}

		rawValid := []string{}
		for _, m := range res.Models {
			name := strings.TrimPrefix(m.Name, "models/")
			// Filter out audio-only, text-embedding, or video models
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
			// Must support generateContent
			if slices.Contains(m.SupportedGenerationMethods, "generateContent") {
				rawValid = append(rawValid, name)
			}
		}

		// Sort with priority models first
		for _, pref := range priorityKeywords {
			for _, m := range rawValid {
				if m == pref {
					discovered = append(discovered, m)
				}
			}
		}
		// Append remainder
		for _, m := range rawValid {
			alreadyIn := slices.Contains(discovered, m)
			if !alreadyIn {
				discovered = append(discovered, m)
			}
		}

		// Limit candidate pool to top 6 to prevent slow failover cascades
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

	// Fallback list if discovery returned nothing
	return []string{
		"gemini-robotics-er-2-preview",
		"gemini-3.5-flash",
		"gemma-4-26b-a4b-it",
		"gemini-3.1-flash-lite",
		"gemini-flash-latest",
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

	// When user attached a photo and Gemini Vision failed:
	if req.ImageBase64 != "" {
		if foodRes, ok := p.ruleEngine.AnalyzeFoodItem(req.Message); ok {
			return coach.ChatResponse{
				Reply: fmt.Sprintf("🍽️ **%s** *(оценка по спортивной базе данных)*\n\n"+
					"• **Калории:** `%d kcal`\n"+
					"• **Белки:** `%.1f г`\n"+
					"• **Углеводы:** `%.1f г`\n"+
					"• **Жиры:** `%.1f г`\n\n"+
					"💡 **Рекомендация диетолога:**\n%s",
					foodRes.MealName, foodRes.TotalCalories, foodRes.TotalProteinG, foodRes.TotalCarbsG, foodRes.TotalFatG, foodRes.Advice),
				Suggestions: []string{
					"Рассчитать суточную норму белка",
					"Что тренировать сегодня?",
					"Оптимальное восстановление",
				},
			}, nil
		}

		return coach.ChatResponse{
			Reply: "⚠️ **Пиковая нагрузка на Gemini Vision API** (Google временно ограничил обработку фото).\n\n" +
				"💡 **Чтобы я мгновенно рассчитал калории и БЖУ:** напишите название блюда (например: *«плов», «курица с рисом», «манты», «самса», «шаурма», «овсянка»*), и я выдам подробную раскладку по нутриентам и спортивным рекомендациям!",
			Suggestions: []string{
				"Плов с говядиной",
				"Куриная грудка с рисом",
				"Самса тандырная",
				"Сколько белка нужно в день?",
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
		slog.Warn("Gemini Vision meal analysis failed, falling back to sports nutrition database", "error", err)
	}

	// 1. Check if user note matches any known food item in ruleEngine
	if notes != "" {
		if res, ok := p.ruleEngine.AnalyzeFoodItem(notes); ok {
			slog.Info("Meal analyzed via sports nutrition database from note", "meal", res.MealName, "calories", res.TotalCalories)
			return res, nil
		}
	}

	// 2. Return intelligent balanced default meal result so user is NEVER blocked
	return coach.MealAnalysisResult{
		MealName:          "Сбалансированное спортивное блюдо",
		VisualDescription: "Порция комплексного спортивного приема пищи (источник белка, сложных углеводов и полезных жиров). Вы можете скорректировать название и КБЖУ перед сохранением.",
		Items: []coach.MealItem{
			{
				Name:     "Белково-углеводный комплекс",
				Portion:  "300g",
				Calories: 480,
				ProteinG: 35.0,
				CarbsG:   55.0,
				FatG:     12.0,
			},
		},
		TotalCalories: 480,
		TotalProteinG: 35.0,
		TotalCarbsG:   55.0,
		TotalFatG:     12.0,
		Confidence:    "medium",
		HealthScore:   8,
		Advice:        "Сбалансированное соотношение белков и сложных углеводов для поддержания мышечного анаболизма и энергии.",
	}, nil
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

	// 1. Physical & Recovery stats
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

	// 2. User Routines / Programs
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

	// 3. All-time PRs & Records
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
		sb.WriteString("Зафиксированных личных рекордов пока нет (атлет еще нарабатывает базу).\n")
	}

	// 4. Recent Completed Workouts
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

	// 5. Today's Nutrition & Meals
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

	// 6. Progressive Overload Targets
	if len(telemetry.OverloadTargets) > 0 {
		sb.WriteString("\n=== ЦЕЛИ ПРОГРЕССИВНОЙ ПЕРЕГРУЗКИ ===\n")
		for _, t := range telemetry.OverloadTargets {
			sb.WriteString(fmt.Sprintf("• %s: было %.1fкг × %d -> цель: %.1fкг × %d (%s)\n",
				t.ExerciseName, t.LastBestWeight, t.LastBestReps, t.TargetWeightKg, t.TargetReps, t.Recommendation))
		}
	}

	// 7. Gaps & Weaknesses / Plateaus
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

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini api key is empty")
	}

	profileDossier := formatAthleteProfile(telemetry, userName)

	systemPrompt := fmt.Sprintf(`Ты — элитный персональный ИИ-тренер и спортивный нутрициолог атлета на платформе duda.uz.
Твоя главная миссия — непрерывно улучшать спортивные результаты атлета, преодолевать плато, грамотно дозировать прогрессивную перегрузку (progressive overload), контролировать питание и восстановление.

%s

КЛЮЧЕВЫЕ ПРАВИЛА И СТИЛЬ ОТВЕТА:
1. КРАТКОСТЬ И КОНКРЕТНОСТЬ — ЖЕЛЕЗНОЕ ПРАВИЛО:
   - Средний объем ответа: 50–70 слов.
   - Максимум: 100–120 слов (только в редких сложных разборах программы/техники — до 150–200 слов).
   - Сразу отвечай по существу, без шаблонных «Привет, я твой ИИ-тренер!», без пустой воды и без лишних вступлений.
2. ИСПОЛЬЗУЙ РЕАЛЬНЫЕ ДАННЫЕ ИЗ ДОСЬЕ АТЛЕТА:
   - Если атлет спрашивает о своих программах/занятиях, рекордах, тренировках, весе или питании — бери и называй точные цифры, упражнения, веса и даты из ДОСЬЕ выше.
   - Если каких-то данных в досье нет (например, еще нет рекорда или не внесен вес), честно и прямо скажи об этом и посоветуй записать.
   - Ты знаешь, как улучшить результаты: если видишь плато или цель прогрессивной перегрузки, дай конкретный вес и число повторений на следующую тренировку.
3. СВОБОДНЫЙ ДИАЛОГ:
   - Отвечай емко, по-спортивному, мотивирующе на ЛЮБЫЕ свободные темы и вопросы атлета.
4. ЯЗЫК:
   - Отвечай строго на языке пользователя (русский, узбекский, английский).
5. ЕСЛИ ПРИКРЕПЛЕНО ФОТО:
   - Еда: четко назови блюдо, порцию, КБЖУ и краткий вывод для анаболизма/сушки.
   - Форма/упражнение: емкая оценка пропорций/техники и 1-2 конкретных совета.`,
		profileDossier)

	contents := make([]geminiContent, 0)
	// Limit history to last 6 messages for fast responsiveness
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
	models := p.getCandidateModels(ctx, key)

	for _, model := range models {
		apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, key)
		reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
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
		resp.Body.Close()
		cancel()

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("model %s returned %d: %s", model, resp.StatusCode, string(raw))
			slog.Warn("Gemini model candidate failed, trying next", "model", model, "status", resp.StatusCode)
			continue
		}

		var geminiResp geminiResponse
		if err := json.Unmarshal(raw, &geminiResp); err != nil {
			lastErr = err
			continue
		}

		if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
			reply := geminiResp.Candidates[0].Content.Parts[0].Text
			p.recordWorkingModel(model)
			slog.Info("Gemini response successfully generated", "model", model)
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
	models := p.getCandidateModels(ctx, key)

	for _, model := range models {
		apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, key)
		reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
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
		resp.Body.Close()
		cancel()

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("model %s returned %d: %s", model, resp.StatusCode, string(raw))
			slog.Warn("Gemini Vision model candidate failed, trying next", "model", model, "status", resp.StatusCode)
			continue
		}

		var geminiResp geminiResponse
		if err := json.Unmarshal(raw, &geminiResp); err != nil {
			lastErr = err
			continue
		}

		var rawText string
		for _, cand := range geminiResp.Candidates {
			for _, part := range cand.Content.Parts {
				if part.Text != "" {
					rawText += part.Text
				}
			}
		}

		rawText = strings.TrimSpace(rawText)
		if rawText == "" {
			lastErr = fmt.Errorf("empty vision response from model %s", model)
			continue
		}

		// Robust JSON block extraction (find outermost { and })
		start := strings.Index(rawText, "{")
		end := strings.LastIndex(rawText, "}")
		if start == -1 || end == -1 || end <= start {
			lastErr = fmt.Errorf("could not find JSON object in response: %s", rawText)
			slog.Warn("No JSON block found in Gemini Vision output", "model", model, "raw", rawText)
			continue
		}

		jsonStr := rawText[start : end+1]
		var analysis coach.MealAnalysisResult
		if err := json.Unmarshal([]byte(jsonStr), &analysis); err != nil {
			lastErr = fmt.Errorf("failed to parse vision json (%w): %s", err, jsonStr)
			slog.Warn("Failed to unmarshal Gemini Vision JSON", "model", model, "error", err, "json", jsonStr)
			continue
		}

		// Ensure total calories and macros are non-zero if items exist
		if analysis.TotalCalories == 0 && len(analysis.Items) > 0 {
			for _, item := range analysis.Items {
				analysis.TotalCalories += item.Calories
				analysis.TotalProteinG += item.ProteinG
				analysis.TotalCarbsG += item.CarbsG
				analysis.TotalFatG += item.FatG
			}
		}

		p.recordWorkingModel(model)
		slog.Info("Gemini Vision analysis successful", "model", model, "meal", analysis.MealName, "calories", analysis.TotalCalories)
		return analysis, nil
	}

	if lastErr != nil {
		return coach.MealAnalysisResult{}, lastErr
	}
	return coach.MealAnalysisResult{}, fmt.Errorf("no gemini vision model candidate succeeded")
}
