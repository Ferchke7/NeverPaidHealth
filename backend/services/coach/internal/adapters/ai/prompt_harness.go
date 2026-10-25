package ai

import (
	_ "embed"
	"fmt"
	"strings"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

//go:embed prompts/coach_system.md
var coachSystemPromptTemplate string

//go:embed prompts/nutrition_analysis.md
var nutritionPromptTemplate string

// buildCoachSystemPrompt constructs the fully bound prompt for Gemini using the markdown harness.
func buildCoachSystemPrompt(userName string, telemetry coach.CoachInsights, profileDossier string, lang string) string {
	langInstruction := "Отвечай строго на чистом, профессиональном русском языке. Используй терминологию доказательного силового тренинга."
	if lang == "uz" {
		langInstruction = "Javobni FAQAT O'zbek tilida (Lotin alifbosida), professional va ilmiy asoslangan sport murabbiyi sifatida yoz. Dalillarga asoslangan sport terminologiyasidan foydalan."
	} else if lang == "en" {
		langInstruction = "Answer strictly in English as an elite evidence-based strength & conditioning physiologist and nutritionist."
	}

	userDisplay := strings.TrimSpace(userName)
	if userDisplay == "" {
		userDisplay = "атлет"
	}

	prompt := coachSystemPromptTemplate
	if prompt == "" {
		// Fallback in case template fails to embed
		prompt = "Ты — главный тренер по силовой подготовке и спортивный физиолог NeverPaidHealth. Досье:\n{{ATHLETE_DOSSIER}}\n{{LANG_INSTRUCTION}}"
	}

	prompt = strings.ReplaceAll(prompt, "{{USER_NAME}}", userDisplay)
	prompt = strings.ReplaceAll(prompt, "{{ATHLETE_DOSSIER}}", profileDossier)
	prompt = strings.ReplaceAll(prompt, "{{READINESS_SCORE}}", fmt.Sprintf("%d", telemetry.ReadinessScore))
	prompt = strings.ReplaceAll(prompt, "{{ACWR}}", fmt.Sprintf("%.2f", telemetry.CNS.ACWR))
	prompt = strings.ReplaceAll(prompt, "{{LANG_INSTRUCTION}}", langInstruction)

	return prompt
}
