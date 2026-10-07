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
		case strings.Contains(msg, "привет") || strings.Contains(msg, "салам") || strings.Contains(msg, "здравствуй"):
			reply.WriteString(fmt.Sprintf("Привет, %s! 🦾 Я на связи. Задавай любой вопрос по тренировкам, питанию или прикрепляй фото блюда/формы — отвечу коротко и по делу!", userName))
			suggestions = []string{
				"Что тренировать сегодня?",
				"Сколько белка нужно в день?",
				"Как прогрессировать в жиме?",
			}

		case strings.Contains(msg, "восстановлен") || strings.Contains(msg, "объем") || strings.Contains(msg, "отдых") || strings.Contains(msg, "перетрен"):
			reply.WriteString(fmt.Sprintf("🔋 **Восстановление (ЦНС: %d%%, %s):**\n\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString("• **Объем:** 10–18 тяжелых подходов на группу в неделю (RPE 7-8.5).\n")
			reply.WriteString("• **Сон:** 7.5–8.5 часов для синтеза белка и гормона роста.\n")
			reply.WriteString("• **Отдых между сетами:** 2.5–3 мин в базе (жим/присед), 1.5–2 мин в изоляции.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Сколько белка нужно в день?",
				"Как преодолеть плато?",
			}

		case strings.Contains(msg, "сегодня") || strings.Contains(msg, "план") || strings.Contains(msg, "что тренировать") || strings.Contains(msg, "тренировк"):
			reply.WriteString(fmt.Sprintf("🏋️‍♂️ **План на сегодня:** `%s`\n\n", telemetry.SuggestedSplit))
			reply.WriteString(fmt.Sprintf("Готовность ЦНС: **%d/100** (%s). Тоннаж 7д: **%.0f кг**.\n", telemetry.ReadinessScore, telemetry.RecoveryStatus, telemetry.WeeklyVolumeKg))
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("🎯 **Цель:** %s — попробуй **%.1f кг × %d повт.**", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			} else {
				reply.WriteString("💡 Держи запас 1–2 повтора (RPE 8) в основных рабочих сетах.")
			}
			suggestions = []string{
				"Как прогрессировать в жиме?",
				"Сколько отдыхать между подходами?",
				"Норма белка на сегодня",
			}

		case strings.Contains(msg, "жим") || strings.Contains(msg, "груд"):
			reply.WriteString("💪 **Прогрессия в жиме лежа:**\n\n")
			reply.WriteString("1. Чередуй тяжелый день (4–6 повт.) и объемный день (8–10 повт.).\n")
			reply.WriteString("2. Своди лопатки, делай паузу 1 сек на груди и используй упор ногами (leg drive).\n")
			reply.WriteString("3. Шаг веса: +1.25–2.5 кг только после закрытия всех подходов в целевом диапазоне.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Как преодолеть плато?",
				"Сколько белка принимать?",
			}

		case strings.Contains(msg, "присед") || strings.Contains(msg, "ног"):
			reply.WriteString("🦵 **Прогрессия в приседаниях:**\n\n")
			reply.WriteString("1. Приседай до параллели для максимальной гипертрофии квадрицепсов и ягодиц.\n")
			reply.WriteString("2. Держи внутрибрюшное давление (маневр Вальсальвы) на всем повторении.\n")
			reply.WriteString("3. Для баланса обязательно добавь румынскую тягу (RDL) 2–3 раза в неделю.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Как восстанавливаться быстрее?",
				"Проанализируй мой прогресс",
			}

		case strings.Contains(msg, "тяг") || strings.Contains(msg, "спин") || strings.Contains(msg, "подтягиван"):
			reply.WriteString("🥋 **Развитие спины:**\n\n")
			reply.WriteString("1. Сочетай вертикальную тягу (подтягивания) для ширины и горизонтальную (в наклоне) для толщины.\n")
			reply.WriteString("2. Тяни локтями к поясу с паузой в пиковом сокращении.\n")
			reply.WriteString("3. В тяжелых сетах используй лямки, чтобы слабый хват не ограничивал спину.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Как избежать плато?",
				"Сколько белка нужно в день?",
			}

		case strings.Contains(msg, "белок") || strings.Contains(msg, "питан") || strings.Contains(msg, "калор") || strings.Contains(msg, "диета"):
			reply.WriteString("🥩 **Нормы спортивного питания:**\n\n")
			reply.WriteString("• **Белок:** 1.6–2.2 г на 1 кг веса (30–40 г на порцию).\n")
			reply.WriteString("• **Углеводы:** 3–5 г/кг для энергии и гликогена.\n")
			reply.WriteString("• **Вода:** 35–40 мл на 1 кг веса тела ежедневно.\n")
			reply.WriteString("• **Креатин:** 3–5 г ежедневно без фазы загрузки.")
			suggestions = []string{
				"Что тренировать сегодня?",
				"Оптимальное восстановление",
				"Как преодолеть плато?",
			}

		case strings.Contains(msg, "прогресс") || strings.Contains(msg, "анализ") || strings.Contains(msg, "результат"):
			reply.WriteString(fmt.Sprintf("📊 **Прогресс %s:** 7 дней: **%d тр.** (тоннаж **%.0f кг**), ЦНС: **%d%%** (%s).\n\n",
				userName, telemetry.WeeklyWorkoutsCount, telemetry.WeeklyVolumeKg, telemetry.ReadinessScore, telemetry.RecoveryStatus))
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("🎯 **Ближайшая цель:** %s -> `%.1f кг × %d`.", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			} else {
				reply.WriteString("🚀 Динамика стабильная, перетренированности нет!")
			}
			suggestions = []string{
				"Что тренировать сегодня?",
				"Оптимальное восстановление",
				"Сколько белка нужно в день?",
			}

		case strings.Contains(msg, "плато") || strings.Contains(msg, "застой") || strings.Contains(msg, "не растет"):
			reply.WriteString("🛑 **Преодоление плато:**\n\n")
			reply.WriteString("1. Сделай Deload (снизь вес на 10% на неделю).\n")
			reply.WriteString("2. Смени диапазон (с 8–10 на 4–6 или 12–15).\n")
			reply.WriteString("3. Проверь калории (+200-300 ккал) и сон (>=8ч).")
			suggestions = []string{
				"Рассчитай мой рабочий вес",
				"Что тренировать сегодня?",
				"Проанализируй мой прогресс",
			}

		case strings.Contains(msg, "рекорд") || strings.Contains(msg, "1rm") || strings.Contains(msg, "максимум") || strings.Contains(msg, "личные"):
			prs := telemetry.AllTimePRs
			if len(prs) == 0 {
				prs = telemetry.RecentTopPRs
			}
			if len(prs) > 0 {
				reply.WriteString(fmt.Sprintf("🏆 **Личные рекорды %s:**\n\n", userName))
				for i, pr := range prs {
					if i >= 5 {
						break
					}
					oneRM := ""
					if pr.Estimated1RM > 0 {
						oneRM = fmt.Sprintf(" *(расчетный 1RM: %.1f кг)*", pr.Estimated1RM)
					}
					reply.WriteString(fmt.Sprintf("• **%s:** `%.1f кг`%s\n", pr.ExerciseName, pr.Value, oneRM))
				}
				reply.WriteString("\n🎯 Чтобы прогрессировать дальше, держи шаг +1.25–2.5 кг раз в 1-2 недели.")
			} else {
				reply.WriteString("📝 В базе пока нет зафиксированных рекордов. Заверши тренировку с рабочими весами, и я автоматически рассчитаю твои 1RM и PRs!")
			}
			suggestions = []string{
				"Какие у меня программы?",
				"Что тренировать сегодня?",
				"Как прогрессировать в жиме?",
			}

		case strings.Contains(msg, "программ") || strings.Contains(msg, "заняти") || strings.Contains(msg, "рутин") || strings.Contains(msg, "шаблон"):
			if len(telemetry.UserRoutines) > 0 {
				reply.WriteString(fmt.Sprintf("📋 **Твои программы тренировок (%d):**\n\n", len(telemetry.UserRoutines)))
				for i, r := range telemetry.UserRoutines {
					if i >= 4 {
						break
					}
					exStr := "список упражнений пуст"
					if len(r.Exercises) > 0 {
						exStr = strings.Join(r.Exercises, ", ")
					}
					reply.WriteString(fmt.Sprintf("• **%s:** %s\n", r.Name, exStr))
				}
				reply.WriteString(fmt.Sprintf("\n💡 Рекомендуемый сплит на сегодня: **%s**", telemetry.SuggestedSplit))
			} else {
				reply.WriteString("📋 Сохраненных программ пока нет. Создай шаблон во вкладке «Тренировки» или выбери готовый сплит!")
			}
			suggestions = []string{
				"Какие у меня рекорды?",
				"Что тренировать сегодня?",
				"Оптимальное восстановление",
			}

		case strings.Contains(msg, "данны") || strings.Contains(msg, "досье") || strings.Contains(msg, "инфо") || strings.Contains(msg, "что у меня есть"):
			reply.WriteString(fmt.Sprintf("📊 **Досье атлета %s:**\n\n", userName))
			if telemetry.CurrentWeightKg > 0 {
				reply.WriteString(fmt.Sprintf("• **Вес:** `%.1f кг` | ИМТ: `%.1f`\n", telemetry.CurrentWeightKg, telemetry.BMI))
			}
			reply.WriteString(fmt.Sprintf("• **ЦНС / Восстановление:** `%d/100` (%s)\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString(fmt.Sprintf("• **Активность 7д:** %d тренировок (тоннаж %.0f кг)\n", telemetry.WeeklyWorkoutsCount, telemetry.WeeklyVolumeKg))
			reply.WriteString(fmt.Sprintf("• **Программ в базе:** %d | **Рекордов:** %d\n", len(telemetry.UserRoutines), len(telemetry.AllTimePRs)))
			if len(telemetry.GapsAndWeaknesses) > 0 {
				reply.WriteString(fmt.Sprintf("⚠️ **Зона роста:** %s", telemetry.GapsAndWeaknesses[0]))
			}
			suggestions = []string{
				"Какие у меня рекорды?",
				"Какие у меня программы?",
				"Что тренировать сегодня?",
			}

		default:
			reply.WriteString(fmt.Sprintf("Привет, %s! 🦾 Готовность ЦНС: **%d/100** (%s).\n\n", userName, telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString("Я знаю все твои программы, рекорды и историю тренировок. Задавай любой вопрос по тренингу, питанию или прогрессии — отвечу коротко и по фактам!")
			suggestions = []string{
				"Какие у меня рекорды?",
				"Какие у меня программы?",
				"Что тренировать сегодня?",
			}
		}
	} else {
		// English Response
		switch {
		case strings.Contains(msg, "today") || strings.Contains(msg, "plan") || strings.Contains(msg, "workout") || strings.Contains(msg, "train"):
			reply.WriteString(fmt.Sprintf("🏋️‍♂️ **Today's Session:** `%s`\n\n", telemetry.SuggestedSplit))
			reply.WriteString(fmt.Sprintf("Readiness: **%d/100** (%s). 7-day volume: **%.0f kg**.\n", telemetry.ReadinessScore, telemetry.RecoveryStatus, telemetry.WeeklyVolumeKg))
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("🎯 **Target:** %s — try **%.1f kg × %d reps**.", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			}
			suggestions = []string{
				"Analyze my progress",
				"How to break a plateau?",
				"Optimal rest between sets?",
			}

		default:
			reply.WriteString(fmt.Sprintf("Hey %s! 🦾 Readiness is **%d/100** (%s).\n\n", userName, telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString("Feel free to ask any question about workout splits, progressive overload, nutrition, or attach a meal/physique photo!")
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

