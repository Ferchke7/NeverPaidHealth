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
		reply.WriteString("ℹ️ *[Офлайн база знаний: спортивная наука]*\n\n")

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
			reply.WriteString(fmt.Sprintf("Привет, %s! 🦾\n\n", userName))
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
		reply.WriteString("ℹ️ *[Offline Sports Science Knowledge Base]*\n\n")
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
			reply.WriteString(fmt.Sprintf("Hello %s! I am your NeverPaidHealth Coach. 🦾\n\n", userName))
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

func (r *RuleEngineProvider) AnalyzeFoodItem(text string) (coach.MealAnalysisResult, bool) {
	lower := strings.ToLower(text)

	type foodEntry struct {
		keywords []string
		name     string
		desc     string
		portion  string
		calories int
		protein  float64
		carbs    float64
		fat      float64
		advice   string
	}

	entries := []foodEntry{
		{
			keywords: []string{"плов", "plov", "osh", "ош"},
			name:     "Узбекский плов с говядиной",
			desc:     "Традиционный узбекский плов из риса лазер/девзира с кусочками тушеной говядины, желтой морковью, нутом и зирой.",
			portion:  "320g",
			calories: 680,
			protein:  28.0,
			carbs:    76.0,
			fat:      29.0,
			advice:   "Отличный источник сложных углеводов и белка. Рекомендуется употреблять с салатом Аччик-чучук / Шакароб для лучшего усвоения.",
		},
		{
			keywords: []string{"манты", "manti", "mantu"},
			name:     "Манты на пару с мясом (4 шт.)",
			desc:     "Сочные паровые манты из тонкого пресного теста с начинкой из рубленой говядины, лука и специй.",
			portion:  "280g",
			calories: 540,
			protein:  24.0,
			carbs:    52.0,
			fat:      26.0,
			advice:   "Приготовление на пару сохраняет микроэлементы мяса. Подавайте с нежирным катыком / сметаной.",
		},
		{
			keywords: []string{"самса", "сомса", "somsa", "samsa"},
			name:     "Самса тандырная с мясом",
			desc:     "Слоеная тандырная выпечка с начинкой из сочной говядины, лука и кумина (зиры).",
			portion:  "160g",
			calories: 420,
			protein:  16.0,
			carbs:    38.0,
			fat:      24.0,
			advice:   "Калорийный продукт с умеренным количеством белка. Отличный перекус перед объемной силовой тренировкой.",
		},
		{
			keywords: []string{"куриц", "грудк", "курин", "chicken", "рис", "рис с кур", "курка"},
			name:     "Куриное филе с рисом и овощами",
			desc:     "Диетическое запеченное куриное филе с отварным рисом и свежими/паровыми овощами.",
			portion:  "350g",
			calories: 460,
			protein:  42.0,
			carbs:    58.0,
			fat:      6.0,
			advice:   "Эталонный фитнес-прием пищи с высоким содержанием чистого белка и низким жиром для максимального синтеза мышечного белка.",
		},
		{
			keywords: []string{"гречк", "греча", "buckwheat"},
			name:     "Гречневая каша с говядиной / курицей",
			desc:     "Отварная гречневая крупа с постным мясом, богатая железом, магнием и медленными углеводами.",
			portion:  "320g",
			calories: 420,
			protein:  36.0,
			carbs:    52.0,
			fat:      7.0,
			advice:   "Идеальный медленный источник энергии с высоким индексом насыщения и низким гликемическим индексом.",
		},
		{
			keywords: []string{"овсянк", "овсян", "oats", "геркулес", "каша"},
			name:     "Овсяная каша с ягодами / орехами",
			desc:     "Цельнозерновая овсяная каша, богатая бета-глюканами и клетчаткой.",
			portion:  "250g",
			calories: 320,
			protein:  12.0,
			carbs:    54.0,
			fat:      6.0,
			advice:   "Идеальный предтренировочный завтрак за 1.5–2 часа до силовой нагрузки.",
		},
		{
			keywords: []string{"яйц", "яичниц", "омлет", "eggs", "глазунья"},
			name:     "Яичница из 3 цельных яиц",
			desc:     "Блюдо из куриных яиц с полноценным аминокислотным профилем, холином и полезными жирами.",
			portion:  "180g",
			calories: 280,
			protein:  21.0,
			carbs:    2.0,
			fat:      20.0,
			advice:   "Яичный белок обладает биологической ценностью 100 BV — эталон усвоения аминокислот.",
		},
		{
			keywords: []string{"творог", "cottage", "творож"},
			name:     "Творог натуральный 5%",
			desc:     "Порция натурального творога с медленным мицеллярным казеином для длительного питания мышц.",
			portion:  "200g",
			calories: 240,
			protein:  34.0,
			carbs:    6.0,
			fat:      10.0,
			advice:   "Идеален на ночь или между длинными приемами пищи для предотвращения ночного катаболизма.",
		},
		{
			keywords: []string{"шаурм", "шаверм", "донер", "shaurma", "doner", "лаваш"},
			name:     "Шаурма / Лаваш с курицей и овощами",
			desc:     "Лаваш с куриным мясом на вертеле, свежей капустой, огурцами, помидорами и соусом.",
			portion:  "350g",
			calories: 640,
			protein:  34.0,
			carbs:    66.0,
			fat:      28.0,
			advice:   "Сбалансированный стритфуд по белкам и углеводам. Просите соус без майонеза для снижения лишних жиров.",
		},
		{
			keywords: []string{"стейк", "говядин", "steak", "мясо"},
			name:     "Стейк из говядины на гриле",
			desc:     "Порция сочного говяжьего стейка средней прожарки, богатого натуральным креатином, железом и цинком.",
			portion:  "250g",
			calories: 520,
			protein:  54.0,
			carbs:    0.0,
			fat:      32.0,
			advice:   "Мощный источник гемового железа и креатина для восстановления силовых показателей.",
		},
		{
			keywords: []string{"протеин", "гейнер", "шейк", "whey", "protein"},
			name:     "Сывороточный протеиновый коктейль",
			desc:     "Порция сывороточного изолята/концентрата на воде или молоке с быстрыми BCAA.",
			portion:  "300ml",
			calories: 180,
			protein:  30.0,
			carbs:    6.0,
			fat:      3.0,
			advice:   "Быстро поднимает уровень лейцина в плазме крови и стимулирует гипертрофию.",
		},
		{
			keywords: []string{"банан", "banana"},
			name:     "Свежий банан (1 шт.)",
			desc:     "Свежий фрукт, богатый калием для нервно-мышечной проводимости и быстрыми углеводами.",
			portion:  "120g",
			calories: 105,
			protein:  1.3,
			carbs:    27.0,
			fat:      0.3,
			advice:   "Отличен прямо перед тренировкой или сразу после для быстрого пополнения гликогена.",
		},
		{
			keywords: []string{"лепешк", "хлеб", "выпечк", "non", "nan", "bread"},
			name:     "Тандырная узбекская лепешка (половина)",
			desc:     "Свежая пшеничная лепешка из тандыра с семенами кунжута/седоны.",
			portion:  "150g",
			calories: 390,
			protein:  11.0,
			carbs:    76.0,
			fat:      3.0,
			advice:   "Высокоуглеводный продукт. Идеален для закрытия углеводного окна после тяжелой силовой нагрузки.",
		},
		{
			keywords: []string{"салат", "цезар", "salad"},
			name:     "Салат Цезарь с курицей",
			desc:     "Свежие листья салата романо с кусочками куриного филе на гриле, пармезаном и крутонами.",
			portion:  "250g",
			calories: 380,
			protein:  28.0,
			carbs:    14.0,
			fat:      24.0,
			advice:   "Легкий белковый прием пищи с полезной клетчаткой.",
		},
		{
			keywords: []string{"пицц", "pizza"},
			name:     "Пицца с сыром и ветчиной (2 кусочка)",
			desc:     "Два слайса пиццы на хрустящем тесте с моцареллой, томатным соусом и мясной начинкой.",
			portion:  "220g",
			calories: 560,
			protein:  24.0,
			carbs:    62.0,
			fat:      25.0,
			advice:   "Калорийный прием пищи для читмила или набора мышечной массы.",
		},
		{
			keywords: []string{"сырник", "сырники", "syrniki"},
			name:     "Творожные сырники (3 шт.)",
			desc:     "Пышные сырники из фермерского творога с легкой корочкой.",
			portion:  "180g",
			calories: 380,
			protein:  24.0,
			carbs:    32.0,
			fat:      18.0,
			advice:   "Вкусный и богатый казеиновым белком завтрак.",
		},
	}

	for _, e := range entries {
		for _, kw := range e.keywords {
			if strings.Contains(lower, kw) {
				return coach.MealAnalysisResult{
					MealName:          e.name,
					VisualDescription: e.desc,
					Items: []coach.MealItem{
						{
							Name:     e.name,
							Portion:  e.portion,
							Calories: e.calories,
							ProteinG: e.protein,
							CarbsG:   e.carbs,
							FatG:     e.fat,
						},
					},
					TotalCalories: e.calories,
					TotalProteinG: e.protein,
					TotalCarbsG:   e.carbs,
					TotalFatG:     e.fat,
					Confidence:    "high",
					HealthScore:   8,
					Advice:        e.advice,
				}, true
			}
		}
	}

	return coach.MealAnalysisResult{}, false
}

func containsCyrillic(s string) bool {
	for _, r := range s {
		if (r >= 'а' && r <= 'я') || (r >= 'А' && r <= 'Я') || r == 'ё' || r == 'Ё' {
			return true
		}
	}
	return false
}

