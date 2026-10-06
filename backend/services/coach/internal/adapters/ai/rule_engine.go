package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type RuleEngineProvider struct{}

func NewRuleEngineProvider() *RuleEngineProvider {
	return &RuleEngineProvider{}
}

func (r *RuleEngineProvider) GenerateChatResponse(
	ctx context.Context,
	req coach.ChatRequest,
	telemetry coach.CoachInsights,
	userName string,
) (coach.ChatResponse, error) {
	msg := strings.ToLower(req.Message)
	isRussian := containsCyrillic(req.Message)

	var reply strings.Builder
	var suggestions []string

	if isRussian {
		switch {
		case strings.Contains(msg, "сегодня") || strings.Contains(msg, "план") || strings.Contains(msg, "что тренировать") || strings.Contains(msg, "тренировк"):
			reply.WriteString(fmt.Sprintf("Привет, %s! 🏋️‍♂️\n\n", userName))
			reply.WriteString(fmt.Sprintf("**Твоя готовность к тренировке:** %d/100 (%s).\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString(fmt.Sprintf("**Рекомендованная программа на сегодня:** %s.\n\n", telemetry.SuggestedSplit))
			reply.WriteString("💡 **Совет тренера:**\n")
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("- В упражнении **%s** попробуй взять **%.1f кг** на **%d повт.**\n", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			} else {
				reply.WriteString("- Начни с 2 разминочных подходов по 12-15 повторений с 50% веса.\n")
				reply.WriteString("- В основных подходах держи запас в 1-2 повторения (RPE 8-8.5).\n")
			}
			suggestions = []string{
				"Как прогрессировать в жиме?",
				"Проанализируй мой недельный объем",
				"Сколько отдыхать между подходами?",
			}

		case strings.Contains(msg, "прогресс") || strings.Contains(msg, "анализ") || strings.Contains(msg, "результат"):
			reply.WriteString(fmt.Sprintf("📊 **Анализ твоего прогресса, %s:**\n\n", userName))
			reply.WriteString(fmt.Sprintf("- 📅 Тренировок за 7 дней: **%d**\n", telemetry.WeeklyWorkoutsCount))
			reply.WriteString(fmt.Sprintf("- ⚖️ Суммарный тоннаж за неделю: **%.0f кг**\n", telemetry.WeeklyVolumeKg))
			reply.WriteString(fmt.Sprintf("- 🔋 Статус восстановления: **%s** (%d дней с прошлой тренировки)\n\n", telemetry.RecoveryStatus, telemetry.DaysSinceLastTrain))

			if len(telemetry.OverloadTargets) > 0 {
				reply.WriteString("🎯 **Точки роста и прогрессивной перегрузки:**\n")
				for i, ot := range telemetry.OverloadTargets {
					if i >= 3 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s**: прошлая сессия %.1f кг × %d повт. -> Цель: **%.1f кг × %d повт.**\n", ot.ExerciseName, ot.LastBestWeight, ot.LastBestReps, ot.TargetWeightKg, ot.TargetReps))
				}
				reply.WriteString("\n")
			}

			if len(telemetry.PlateauAlerts) > 0 {
				reply.WriteString("⚠️ **Внимание: возможное плато:**\n")
				for _, pl := range telemetry.PlateauAlerts {
					reply.WriteString(fmt.Sprintf("• **%s**: вес стабилизировался. %s\n", pl.ExerciseName, pl.Advice))
				}
			} else {
				reply.WriteString("🚀 **Отличная динамика:** признаков застоя в основных движениях не обнаружено!")
			}

			suggestions = []string{
				"Что тренировать сегодня?",
				"Как разбить группы мышц?",
				"Сколько белка нужно в день?",
			}

		case strings.Contains(msg, "плато") || strings.Contains(msg, "застой") || strings.Contains(msg, "не растет"):
			reply.WriteString("🛑 **Стратегия преодоления силового плато:**\n\n")
			reply.WriteString("1. **Временный Deload (разгрузка):** снизь рабочий вес на 10% на одну неделю, сохранив технику идеальной.\n")
			reply.WriteString("2. **Смена диапазона повторений:** если делал 8-10 повторений, перейди на 4-6 с более тяжелым весом или 12-15 на памп.\n")
			reply.WriteString("3. **Акцент на вспомогательные мышцы:** добавь трицепс/дельты для жима или подтягивания узким хватом для тяги.\n")
			reply.WriteString("4. **Питание и сон:** силовой застой на 70% вызван недостатком калорий или сна (<7 часов).")
			suggestions = []string{
				"Рассчитай мой рабочий вес",
				"Что тренировать сегодня?",
				"Проанализируй мой прогресс",
			}

		default:
			reply.WriteString(fmt.Sprintf("Привет, %s! Я твой персональный ИИ-тренер NeverPaidHealth. 🦾\n\n", userName))
			reply.WriteString(fmt.Sprintf("Я постоянно анализирую твои поднятые килограммы, подходы и восстановление (сейчас твой статус: **%s**, готовность **%d%%**).\n\n", telemetry.RecoveryStatus, telemetry.ReadinessScore))
			reply.WriteString("Задай мне любой вопрос о технике, периодизации, прогрессивной перегрузке или составлении тренировочного сплита!")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Проанализируй мой прогресс",
				"Как преодолеть плато?",
			}
		}
	} else {
		// English Response
		switch {
		case strings.Contains(msg, "today") || strings.Contains(msg, "plan") || strings.Contains(msg, "workout") || strings.Contains(msg, "train"):
			reply.WriteString(fmt.Sprintf("Hey %s! 🏋️‍♂️\n\n", userName))
			reply.WriteString(fmt.Sprintf("**Readiness Score:** %d/100 (%s)\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString(fmt.Sprintf("**Recommended Session:** %s\n\n", telemetry.SuggestedSplit))
			reply.WriteString("💡 **Coach's Key Directives:**\n")
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("- On **%s**, aim for **%.1f kg** for **%d reps**.\n", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			} else {
				reply.WriteString("- Warm up thoroughly with 2 progressive feeder sets at 50% & 70% load.\n")
				reply.WriteString("- Keep 1-2 reps in reserve (RPE 8) on working compound sets.\n")
			}
			suggestions = []string{
				"Analyze my progress",
				"How to break a plateau?",
				"Optimal rest between sets?",
			}

		case strings.Contains(msg, "progress") || strings.Contains(msg, "analysis") || strings.Contains(msg, "results"):
			reply.WriteString(fmt.Sprintf("📊 **Progress Breakdown for %s:**\n\n", userName))
			reply.WriteString(fmt.Sprintf("- 📅 Past 7 Days: **%d Workouts**\n", telemetry.WeeklyWorkoutsCount))
			reply.WriteString(fmt.Sprintf("- ⚖️ Weekly Volume Tonnage: **%.0f kg**\n", telemetry.WeeklyVolumeKg))
			reply.WriteString(fmt.Sprintf("- 🔋 Recovery: **%s** (%d days since last session)\n\n", telemetry.RecoveryStatus, telemetry.DaysSinceLastTrain))

			if len(telemetry.OverloadTargets) > 0 {
				reply.WriteString("🎯 **Next Session Overload Targets:**\n")
				for i, ot := range telemetry.OverloadTargets {
					if i >= 3 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s**: Last %.1f kg × %d -> Target: **%.1f kg × %d reps**\n", ot.ExerciseName, ot.LastBestWeight, ot.LastBestReps, ot.TargetWeightKg, ot.TargetReps))
				}
			}
			suggestions = []string{
				"What to train today?",
				"Plateau breakthrough tips",
				"Muscle balance analysis",
			}

		default:
			reply.WriteString(fmt.Sprintf("Hello %s! I am your NeverPaidHealth AI Coach. 🦾\n\n", userName))
			reply.WriteString(fmt.Sprintf("Your current readiness is **%d/100** (%s). Ask me anything regarding progressive overload, workout programming, or plateau busting!", telemetry.ReadinessScore, telemetry.RecoveryStatus))
			suggestions = []string{
				"What should I train today?",
				"Analyze my progress",
				"How to break plateaus?",
			}
		}
	}

	return coach.ChatResponse{
		Reply:       reply.String(),
		Suggestions: suggestions,
	}, nil
}

func containsCyrillic(s string) bool {
	for _, r := range s {
		if (r >= 'а' && r <= 'я') || (r >= 'А' && r <= 'Я') || r == 'ё' || r == 'Ё' {
			return true
		}
	}
	return false
}
