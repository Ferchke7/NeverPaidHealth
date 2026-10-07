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
		case strings.Contains(msg, "восстановлен") || strings.Contains(msg, "объем") || strings.Contains(msg, "отдых") || strings.Contains(msg, "перетрен"):
			reply.WriteString(fmt.Sprintf("🔋 **Оптимизация восстановления и объема для %s:**\n\n", userName))
			reply.WriteString(fmt.Sprintf("- **Текущий статус ЦНС:** %d/100 (%s)\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString(fmt.Sprintf("- **Объем за 7 дней:** %.0f кг (%d тренировок)\n\n", telemetry.WeeklyVolumeKg, telemetry.WeeklyWorkoutsCount))
			reply.WriteString("📌 **Научные принципы восстановления (по Dr. Mike Israetel & Jeff Nippard):**\n")
			reply.WriteString("1. **Рабочий объем (MEV -> MAV):** Оптимум для мышечной группы — **10–20 тяжелых подходов в неделю** (RPE 7-9). Если делаешь больше 22 подходов, восстановление резко падает.\n")
			reply.WriteString("2. **Частота на мышечную группу:** 2 раза в неделю стимулирует синтез белка лучше, чем редкие тренировки 1 раз в неделю.\n")
			reply.WriteString("3. **Сон и гормоны:** 80% гормона роста и восстановления миофибрилл вырабатывается во время медленного сна (цель: 7.5–8.5 часов).\n")
			reply.WriteString("4. **Интервал отдыха между подходами:** В базовых движениях (жим, присед, тяга) отдыхай **2.5–3.5 минуты**. В изоляции (бицепс, трицепс, махи) — **1.5–2 минуты**.\n")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Сколько белка нужно в день?",
				"Как преодолеть плато?",
			}

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

		case strings.Contains(msg, "жим") || strings.Contains(msg, "груд"):
			reply.WriteString("💪 **Прогрессия в жиме лежа (Evidence-Based):**\n\n")
			reply.WriteString("1. **Микропериодизация:** Чередуй тяжелый день (4–6 повт., RPE 8.5) и объемный день (8–10 повт., RPE 7.5–8).\n")
			reply.WriteString("2. **Техника и жесткость:** Своди лопатки, делай контролируемую паузу на груди (1 сек) и используй leg drive (упор ногами в пол).\n")
			reply.WriteString("3. **Вспомогательные движения:** Добавь отжимания на брусьях с весом и французский жим для укрепления трицепса.\n")
			reply.WriteString("4. **Шаг прогрессии:** Добавляй по 1.25–2.5 кг только после того, как выполнил все запланированные подходы на верхнюю границу повторений.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Как преодолеть плато?",
				"Сколько белка принимать?",
			}

		case strings.Contains(msg, "присед") || strings.Contains(msg, "ног"):
			reply.WriteString("🦵 **Прогрессия и механика приседаний:**\n\n")
			reply.WriteString("1. **Глубина и траектория:** Приседай минимум до параллели (тазобедренный сустав на уровне или чуть ниже колена) для полной гипертрофии квадрицепсов и ягодиц.\n")
			reply.WriteString("2. **Внутрибрюшное давление:** Освой маневр Вальсальвы — глубокий вдох животом и напряжение кора перед опусканием.\n")
			reply.WriteString("3. **Дополнительный стимул:** Добавь румынскую тягу (RDL) и сгибания ног для баланса квадрицепсов и бицепсов бедра.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Как восстанавливаться быстрее?",
				"Проанализируй мой прогресс",
			}

		case strings.Contains(msg, "тяг") || strings.Contains(msg, "спин") || strings.Contains(msg, "подтягиван"):
			reply.WriteString("🥋 **Развитие мышц спины и тяговых движений:**\n\n")
			reply.WriteString("1. **Два вектора нагрузки:** Сочетай вертикальные тяги (подтягивания/тяга верхнего блока) для ширины и горизонтальные (тяга штанги в наклоне/тяга гантели) для толщины спины.\n")
			reply.WriteString("2. **Фокус на сведение лопаток:** Тяни локтями к поясу, а не бицепсом. Делай паузу на пиковом сокращении.\n")
			reply.WriteString("3. **Лямки:** В тяжелых рабочих подходах используй лямки, чтобы слабый хват не лимитировал целевые мышцы спины.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Как избежать плато?",
				"Сколько белка нужно в день?",
			}

		case strings.Contains(msg, "белок") || strings.Contains(msg, "питан") || strings.Contains(msg, "калор") || strings.Contains(msg, "диета"):
			reply.WriteString("🥩 **Научные нормы питания для силового тренинга:**\n\n")
			reply.WriteString("1. **Белок:** Оптимально **1.6–2.2 г на 1 кг массы тела** в день. Распределяй на 3–4 приема пищи по 30–45 г белка.\n")
			reply.WriteString("2. **Углеводы:** Главный источник гликогена для силовых (3–5 г/кг). Принимай порцию сложных углеводов за 1.5–2 часа до тренировки.\n")
			reply.WriteString("3. **Креатин моногидрат:** 3–5 г ежедневно без фазы загрузки повышает запас фосфокреатина и силовую выносливость на 5–10%.\n")
			reply.WriteString("4. **Водный баланс:** 35–45 мл воды на 1 кг веса, особенно в дни тяжелых тренировок.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Оптимальное восстановление",
				"Как преодолеть плато?",
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
				"Оптимальное восстановление",
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
			reply.WriteString(fmt.Sprintf("Привет, %s! Я твой персональный ИИ-тренер duda.uz. 🦾\n\n", userName))
			reply.WriteString(fmt.Sprintf("Твой текущий статус восстановления: **%s** (готовность ЦНС: **%d%%**). За последние 7 дней выполнено **%d тренировок** с тоннажем **%.0f кг**.\n\n", telemetry.RecoveryStatus, telemetry.ReadinessScore, telemetry.WeeklyWorkoutsCount, telemetry.WeeklyVolumeKg))
			reply.WriteString("Ты можешь спросить меня о:\n")
			reply.WriteString("- 🏋️ Оптимальной программе на сегодня и периодизации\n")
			reply.WriteString("- 📈 Прогрессивной перегрузке в жиме, приседе, тягах\n")
			reply.WriteString("- 🔋 Восстановлении, нормах объема и питании\n")
			reply.WriteString("- 🛑 Преодолении плато и расчете 1ПМ")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Оптимальное восстановление",
				"Как прогрессировать в жиме?",
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
