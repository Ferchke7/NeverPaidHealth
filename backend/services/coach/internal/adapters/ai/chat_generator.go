package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

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

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName, lang string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini api key is empty")
	}

	// Execute Hybrid RAG retrieval (Personal Episodic Memory + Sports Science Knowledge Base)
	ragCtx := coach.RetrieveHybridRAGContext(req.Message, telemetry)
	profileDossier := formatAthleteProfileAndRAG(telemetry, ragCtx, userName)

	langInstruction := "Отвечай строго на чистом, профессиональном русском языке."
	if lang == "uz" {
		langInstruction = "Javobni FAQAT O'zbek tilida (Lotin alifbosida), professional va ilmiy asoslangan sport murabbiyi sifatida yoz."
	} else if lang == "en" {
		langInstruction = "Answer strictly in English as an elite evidence-based strength & conditioning physiologist."
	}

	systemPrompt := fmt.Sprintf(`Ты — главный тренер по силовой подготовке и спортивный физиолог атлета (%s) на платформе duda.uz.
Твой профиль: доказательная спортивная физиология, биомеханика и периодизация (уровень Dr. Mike Israetel, Eric Helms, Brad Schoenfeld, Greg Nuckols).

Ниже приведено ПОЛНОЕ МНОГОГОРИЗОНТНОЕ ДОСЬЕ АТЛЕТА (телеметрия за 90 дней, модель утомления ЦНС Банистера, матрица восстановления мышц MEV/MAV/MRV, расчетные 1RM по формуле Бжицки и извлеченные модули Hybrid RAG):

%s

ПРОТОКОЛ РАБОТЫ И ЖЕСТКИЕ ПРАВИЛА ОТВЕТА:
1. ЗАПРЕТ НА ВОДУ И ШАБЛОННЫЕ ФРАЗЫ:
   - Никаких вступлений вроде «Привет! Я твой ИИ-тренер», «Отличный вопрос!», «Продолжай в том же духе!».
   - Начинай ответ сразу с точной аналитики и конкретных цифр атлета.
2. СТРОГАЯ ОПОРА НА ТЕЛЕМЕТРИЮ И HYBRID RAG (ZERO HALLUCINATION):
   - Обязательно цитируй реальные цифры из досье: точные веса и повторения из истории подходов, расчетный 1RM по Бжицки, индекс готовности ЦНС (%d/100), коэффициент ACWR (%.2f), процент восстановления конкретных мышечных групп и недельное количество подходов относительно MEV/MAV/MRV.
   - При назначении следующей тренировки используй реальные шаблоны/программы атлета из Раздела 4 и точные целевые веса двойной прогрессии из Раздела 8 (с указанием подходов, повторений и RIR 1–2).
   - При вопросах о питании для атлета с повышенным ИМТ опирайся на расчет белка по сухой мышечной массе (LBM) из Раздела 1, а не на умножение полного веса с жировой тканью.
3. УЛЬТРА-КРАТКОСТЬ И ВИЗУАЛЬНАЯ ЧИСТОТА (БЕЗ ПРОСТЫНЕЙ ТЕКСТА):
   - Строгий лимит: **50–95 слов максимум** (3–4 емких буллита). Никаких длинных абзацев, лекций и общих рассуждений!
   - Формат каждой строки: **Метрика/Упражнение** → точная цифра из досье → конкретное действие (**вес кг × повторы × подходы**, RIR или КБЖУ).
   - Если атлет спрашивает про тренировку, дай краткую выжимку (3–4 пункта), так как к твоему ответу автоматически прикрепится интерактивная карточка запуска тренировки.
4. ЯЗЫК ОТВЕТА:
   %s
5. МУЛЬТИМОДАЛЬНОСТЬ (ЕСЛИ ПРИКРЕПЛЕНО ФОТО):
   - Фото блюда: кратко перечисли состав, граммовку, калории и БЖУ, сопоставь с суточной нормой LBM атлета.
   - Фото тела/техники: дай четкий разбор пропорций или углов рычагов в 3–4 буллитах.`,
		userName, profileDossier, telemetry.ReadinessScore, telemetry.CNS.ACWR, langInstruction)

	contents := make([]geminiContent, 0)
	history := req.History
	if len(history) > 8 {
		history = history[len(history)-8:]
	}
	for _, h := range history {
		role := "user"
		if h.Role == "coach" {
			role = "model"
		}
		parts := make([]geminiPart, 0)
		if part := createInlineDataPart(h.ImageBase64, h.MimeType); part != nil {
			parts = append(parts, *part)
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
	if part := createInlineDataPart(req.ImageBase64, req.MimeType); part != nil {
		userParts = append(userParts, *part)
	}
	userText := req.Message
	if userText == "" && req.ImageBase64 != "" {
		userText = "Проанализируй фото с привязкой к моему досье и дай точные рекомендации."
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

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 12*time.Second, "Chat")
	if err != nil {
		return coach.ChatResponse{}, err
	}

	reply := extractCandidateText(geminiResp)
	if reply == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini returned empty response")
	}

	return coach.ChatResponse{
		Reply:            strings.TrimSpace(reply),
		Suggestions:      buildContextualSuggestions(telemetry, lang),
		SuggestedWorkout: coach.BuildWorkoutForChatQuery(req.Message, telemetry),
	}, nil
}

func buildContextualSuggestions(telemetry coach.CoachInsights, lang string) []string {
	if lang == "uz" {
		return []string{
			"Bugungi mashg'ulot uchun aniq vazn va takrorlar",
			"Mening 1RM rekordlarim va o'sish dinamikam",
			"Tana vaznimga mos kunlik oqsil va kaloriya",
		}
	}
	if lang == "en" {
		return []string{
			"Exact weights & reps for today's session",
			"Analyze my CNS recovery & weekly volume (MEV/MAV)",
			"My body recomposition macros & protein target",
		}
	}
	if len(telemetry.AllTimePRs) > 0 {
		topEx := telemetry.AllTimePRs[0].ExerciseName
		return []string{
			fmt.Sprintf("План прогрессии в «%s»", topEx),
			"Разбор моего восстановления ЦНС и объема по мышцам",
			"Мои точные КБЖУ для рекомпозиции",
		}
	}
	return []string{
		"Что тренировать сегодня с рабочими весами?",
		"Разбор восстановления ЦНС и недельного объема",
		"Рассчитай мои КБЖУ для рекомпозиции",
	}
}
