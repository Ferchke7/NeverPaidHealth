package ai

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
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
	lang string,
) (coach.ChatResponse, error) {
	msg := strings.ToLower(req.Message)
	if lang == "" {
		if containsCyrillic(req.Message) {
			lang = "ru"
		} else if isUzbekText(req.Message) {
			lang = "uz"
		} else {
			lang = "en"
		}
	}

	var reply strings.Builder
	var suggestions []string

	switch lang {
	case "uz":
		switch {
		case strings.Contains(msg, "salom") || strings.Contains(msg, "assalom") || strings.Contains(msg, "qalaysiz"):
			reply.WriteString(fmt.Sprintf("Salom, %s! 🦾 Men sizning shaxsiy AI murabbiyingizman. Mashg'ulotlar, to'g'ri ovqatlanish yoki progress bo'yicha savollaringizni bering!", userName))
			suggestions = []string{
				"Bugun nima mashq qilamiz?",
				"Kunlik oqsil me'yori qancha?",
				"Jim yotib bosishda qanday o'sish mumkin?",
			}

		case strings.Contains(msg, "bugun") || strings.Contains(msg, "mashq") || strings.Contains(msg, "reja"):
			reply.WriteString(fmt.Sprintf("🏋️‍♂️ **Bugungi reja:** `%s`\n\n", telemetry.SuggestedSplit))
			reply.WriteString(fmt.Sprintf("Markaziy asab tizimi tayyorligi: **%d/100** (%s). 7 kunlik hajm: **%.0f kg**.\n", telemetry.ReadinessScore, telemetry.RecoveryStatus, telemetry.WeeklyVolumeKg))
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("🎯 **Maqsad:** %s — **%.1f kg × %d marta** bajarishga harakat qiling.", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			} else {
				reply.WriteString("💡 Asosiy yondashuvlarda 1–2 takror zaxira (RPE 8) saqlang.")
			}
			suggestions = []string{
				"Oqsil me'yori qancha?",
				"Yondashuvlar orasida qancha dam olish kerak?",
				"Mening natijalarimni tahlil qil",
			}

		case strings.Contains(msg, "oqsil") || strings.Contains(msg, "ovqat") || strings.Contains(msg, "kaloriya") || strings.Contains(msg, "protein"):
			reply.WriteString("🥩 **Sport ovqatlanish me'yorlari:**\n\n")
			reply.WriteString("• **Oqsil:** tana vaznining 1 kg uchun 1.6–2.2 g (bir martada 30–40 g).\n")
			reply.WriteString("• **Uglevodlar:** energiya uchun 3–5 g/kg.\n")
			reply.WriteString("• **Suv:** har kuni 1 kg vaznga 35–40 ml toza suv.\n")
			reply.WriteString("• **Kreatin:** har kuni yuklamasiz 3–5 g.")
			suggestions = []string{
				"Bugun nima mashq qilamiz?",
				"Tiklanish bo'yicha maslahat",
				"Platoni qanday yengish mumkin?",
			}

		default:
			reply.WriteString(fmt.Sprintf("Salom, %s! 🦾 Tayyorgarlik darajasi: **%d/100** (%s).\n\n", userName, telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString("Men sizning barcha mashg'ulotlaringiz, rekordlaringiz va ovqatlanishingizni kuzatib boraman. Har qanday savolingizga aniq va amaliy javob berishga tayyorman!")
			suggestions = []string{
				"Bugun nima mashq qilamiz?",
				"Mening rekordlarim qanday?",
				"Ovqatlanish rejamni tekshir",
			}
		}

	case "en":
		switch {
		case strings.Contains(msg, "hi") || strings.Contains(msg, "hello") || strings.Contains(msg, "hey"):
			reply.WriteString(fmt.Sprintf("Hey %s! 🦾 I'm your AI strength and performance coach. Ask me anything about your training split, progressive overload, or nutrition!", userName))
			suggestions = []string{
				"What should I train today?",
				"How much protein do I need?",
				"Analyze my progress",
			}

		case strings.Contains(msg, "today") || strings.Contains(msg, "plan") || strings.Contains(msg, "workout") || strings.Contains(msg, "train"):
			reply.WriteString(fmt.Sprintf("🏋️‍♂️ **Today's Session:** `%s`\n\n", telemetry.SuggestedSplit))
			reply.WriteString(fmt.Sprintf("CNS Readiness: **%d/100** (%s). 7-day volume: **%.0f kg**.\n", telemetry.ReadinessScore, telemetry.RecoveryStatus, telemetry.WeeklyVolumeKg))
			if len(telemetry.OverloadTargets) > 0 {
				top := telemetry.OverloadTargets[0]
				reply.WriteString(fmt.Sprintf("🎯 **Target:** %s — aim for **%.1f kg × %d reps**.", top.ExerciseName, top.TargetWeightKg, top.TargetReps))
			} else {
				reply.WriteString("💡 Keep 1–2 reps in reserve (RPE 8) on your working compound sets.")
			}
			suggestions = []string{
				"How to break bench press plateau?",
				"Analyze my progress",
				"Optimal rest between sets",
			}

		case strings.Contains(msg, "protein") || strings.Contains(msg, "diet") || strings.Contains(msg, "calorie") || strings.Contains(msg, "nutrition"):
			reply.WriteString("🥩 **Evidence-Based Nutrition Guidelines:**\n\n")
			reply.WriteString("• **Protein:** 1.6–2.2g per kg body weight (30–40g per meal for muscle protein synthesis).\n")
			reply.WriteString("• **Carbohydrates:** 3–5g/kg for optimal glycogen and training power.\n")
			reply.WriteString("• **Hydration:** 35–40ml per kg body weight daily.\n")
			reply.WriteString("• **Creatine Monohydrate:** 3–5g daily without loading phase.")
			suggestions = []string{
				"What should I train today?",
				"Analyze my weekly volume",
				"Recovery advice",
			}

		default:
			reply.WriteString(fmt.Sprintf("Hey %s! 🦾 Readiness is **%d/100** (%s).\n\n", userName, telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString("I track all your routines, personal records, and recovery metrics. Ask any specific question about your training or nutrition!")
			suggestions = []string{
				"What should I train today?",
				"What are my top PRs?",
				"How to break plateaus?",
			}
		}

	default: // Russian
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

		default:
			reply.WriteString(fmt.Sprintf("Привет, %s! 🦾 Готовность ЦНС: **%d/100** (%s).\n\n", userName, telemetry.ReadinessScore, telemetry.RecoveryStatus))
			reply.WriteString("Я знаю все твои программы, рекорды и историю тренировок. Задавай любой вопрос по тренингу, питанию или прогрессии — отвечу коротко и по фактам!")
			suggestions = []string{
				"Какие у меня рекорды?",
				"Какие у меня программы?",
				"Что тренировать сегодня?",
			}
		}
	}

	return coach.ChatResponse{
		Reply:       reply.String(),
		Suggestions: suggestions,
	}, nil
}

type foodProfile struct {
	keywords []string
	nameRu   string
	nameUz   string
	nameEn   string
	baseG    float64
	calories int
	protein  float64
	carbs    float64
	fat      float64
	adviceRu string
	adviceUz string
	adviceEn string
}

var knownFoods = []foodProfile{
	{
		keywords: []string{"яйц", "яичниц", "омлет", "egg", "eggs", "tuxum"},
		nameRu:   "Куриные яйца",
		nameUz:   "Tovuq tuxumi",
		nameEn:   "Whole Eggs",
		baseG:    110, // 2 eggs default
		calories: 155,
		protein:  13.0,
		carbs:    1.1,
		fat:      10.6,
		adviceRu: "Эталонный аминокислотный профиль для анаболизма.",
		adviceUz: "Mushaklar o'sishi uchun ideal aminokislota manbai.",
		adviceEn: "Gold-standard amino acid profile for muscle recovery.",
	},
	{
		keywords: []string{"куриц", "грудк", "филе", "chicken", "breast", "fillet", "tovuq", "tovuq go'shti"},
		nameRu:   "Куриное филе",
		nameUz:   "Tovuq filesi",
		nameEn:   "Chicken Breast",
		baseG:    150,
		calories: 248,
		protein:  46.5,
		carbs:    0.0,
		fat:      5.4,
		adviceRu: "Чистый постный белок высокой биологической ценности.",
		adviceUz: "Yuqori sifatli toza oqsil manbai.",
		adviceEn: "Lean high-quality protein for maximum muscle protein synthesis.",
	},
	{
		keywords: []string{"рис", "rice", "guruch", "osh guruch"},
		nameRu:   "Отварной рис",
		nameUz:   "Pishirilgan guruch",
		nameEn:   "Cooked White/Brown Rice",
		baseG:    150,
		calories: 195,
		protein:  4.1,
		carbs:    43.0,
		fat:      0.6,
		adviceRu: "Чистый источник гликогена для силовой выносливости.",
		adviceUz: "Kuch va energiya uchun toza murakkab uglevod.",
		adviceEn: "Clean carbohydrate source for muscle glycogen replenishment.",
	},
	{
		keywords: []string{"гречк", "греча", "buckwheat", "grechka"},
		nameRu:   "Гречневая каша",
		nameUz:   "Grechka bo'tqasi",
		nameEn:   "Cooked Buckwheat",
		baseG:    150,
		calories: 165,
		protein:  5.4,
		carbs:    31.5,
		fat:      1.8,
		adviceRu: "Богата магнием, железом и сложными медленными углеводами.",
		adviceUz: "Magniy va temirga boy murakkab sekin uglevod.",
		adviceEn: "Rich in magnesium and slow-digesting complex carbs.",
	},
	{
		keywords: []string{"овсянк", "геркулес", "oats", "oatmeal", "suli"},
		nameRu:   "Овсяная каша",
		nameUz:   "Suli bo'tqasi (Ovsyanqa)",
		nameEn:   "Oatmeal",
		baseG:    100,
		calories: 360,
		protein:  12.5,
		carbs:    62.0,
		fat:      6.5,
		adviceRu: "Идеальный медленный предтренировочный источник энергии.",
		adviceUz: "Mashg'ulotdan oldin ajoyib uzoq muddatli energiya manbai.",
		adviceEn: "Ideal sustained slow-burning pre-workout energy.",
	},
	{
		keywords: []string{"плов", "plov", "osh", "palov"},
		nameRu:   "Узбекский плов с говядиной",
		nameUz:   "O'zbekcha mol go'shtli osh / palov",
		nameEn:   "Uzbek Beef Plov",
		baseG:    320,
		calories: 680,
		protein:  28.0,
		carbs:    76.0,
		fat:      29.0,
		adviceRu: "Сытный углеводно-белковый прием пищи. Рекомендуется салат аччик-чучук.",
		adviceUz: "To'yimli uglevod va oqsilli taom. Achchiq-chuchuk salati bilan tavsiya etiladi.",
		adviceEn: "Rich carbohydrate & protein meal. Pair with fresh salad for digestion.",
	},
	{
		keywords: []string{"самса", "сомса", "somsa", "samsa"},
		nameRu:   "Самса тандырная с мясом",
		nameUz:   "Tandir go'shtli somsa",
		nameEn:   "Meat Samsa",
		baseG:    160,
		calories: 420,
		protein:  16.0,
		carbs:    38.0,
		fat:      24.0,
		adviceRu: "Калорийный перекус с умеренным белком.",
		adviceUz: "To'yimli taom, mashg'ulotdan oldin quvvat beradi.",
		adviceEn: "Energy-dense traditional pastry with moderate protein.",
	},
	{
		keywords: []string{"манты", "manti", "mantu"},
		nameRu:   "Манты на пару с говядиной (4 шт)",
		nameUz:   "Bug'da pishgan manti (4 dona)",
		nameEn:   "Steamed Meat Manti (4 pcs)",
		baseG:    280,
		calories: 540,
		protein:  24.0,
		carbs:    52.0,
		fat:      26.0,
		adviceRu: "Приготовление на пару сохраняет питательные вещества.",
		adviceUz: "Bug'da pishirilgani sababli foydali moddalarni saqlab qoladi.",
		adviceEn: "Steaming preserves nutrients and provides quality energy.",
	},
	{
		keywords: []string{"шаурм", "шаверм", "донер", "shaurma", "doner", "lavash", "лаваш"},
		nameRu:   "Лаваш / Шаурма с курицей",
		nameUz:   "Tovuqli lavash / doner",
		nameEn:   "Chicken Shawarma / Wrap",
		baseG:    350,
		calories: 640,
		protein:  34.0,
		carbs:    66.0,
		fat:      28.0,
		adviceRu: "Хороший баланс БЖУ, выбирайте соусы без майонеза.",
		adviceUz: "Yaxshi oqsil va uglevod balansi.",
		adviceEn: "Good balance of protein and carbs. Choose light sauces.",
	},
	{
		keywords: []string{"стейк", "говядин", "мясо", "steak", "beef", "mol go'shti"},
		nameRu:   "Стейк из говядины на гриле",
		nameUz:   "Grilda pishgan mol go'shti steyki",
		nameEn:   "Grilled Beef Steak",
		baseG:    220,
		calories: 480,
		protein:  52.0,
		carbs:    0.0,
		fat:      30.0,
		adviceRu: "Мощный источник гемового железа, цинка и натурального креатина.",
		adviceUz: "Gem temir, rux va tabiiy kreatinga boy kuchli taom.",
		adviceEn: "Potent source of bioavailable heme iron, zinc, and natural creatine.",
	},
	{
		keywords: []string{"творог", "cottage", "tvorog"},
		nameRu:   "Творог 5%",
		nameUz:   "Tvorog 5%",
		nameEn:   "Cottage Cheese 5%",
		baseG:    200,
		calories: 240,
		protein:  34.0,
		carbs:    6.0,
		fat:      10.0,
		adviceRu: "Медленный мицеллярный казеин предотвращает катаболизм.",
		adviceUz: "Sekin hazm bo'ladigan kazein oqsili tunda mushaklarni oziqlantiradi.",
		adviceEn: "Slow-digesting micellar casein protects against muscle breakdown.",
	},
	{
		keywords: []string{"протеин", "гейнер", "шейк", "whey", "protein"},
		nameRu:   "Сывороточный протеин (1 порция)",
		nameUz:   "Zardob oqsili (Whey Protein)",
		nameEn:   "Whey Protein Shake",
		baseG:    300,
		calories: 140,
		protein:  26.0,
		carbs:    3.0,
		fat:      2.0,
		adviceRu: "Быстрое усвоение BCAA и лейцина сразу после тренировки.",
		adviceUz: "Mashg'ulotdan so'ng tez so'riluvchi aminokislotalar.",
		adviceEn: "Rapidly absorbed BCAA & leucine spike for post-workout recovery.",
	},
	{
		keywords: []string{"банан", "banana"},
		nameRu:   "Свежий банан",
		nameUz:   "Banan",
		nameEn:   "Fresh Banana",
		baseG:    120,
		calories: 105,
		protein:  1.3,
		carbs:    27.0,
		fat:      0.3,
		adviceRu: "Калий против судорог и быстрые углеводы перед нагрузкой.",
		adviceUz: "Kaliy va tezkor uglevodlar manbai.",
		adviceEn: "Rich in potassium for muscle contractions and quick training fuel.",
	},
	{
		keywords: []string{"лепешк", "хлеб", "non", "nan", "bread"},
		nameRu:   "Тандырная лепешка / Хлеб",
		nameUz:   "Tandir non",
		nameEn:   "Flatbread / Bread",
		baseG:    150,
		calories: 390,
		protein:  11.0,
		carbs:    76.0,
		fat:      3.0,
		adviceRu: "Высокоуглеводный продукт для восполнения энергии.",
		adviceUz: "Energiya zaxirasini to'ldirish uchun uglevod manbai.",
		adviceEn: "Fast carbohydrate energy replenishment.",
	},
	{
		keywords: []string{"салат", "salad", "bodring", "pomidor", "огурц", "помидор"},
		nameRu:   "Свежий овощной салат",
		nameUz:   "Yangi sabzavotli salat",
		nameEn:   "Fresh Vegetable Salad",
		baseG:    150,
		calories: 55,
		protein:  1.8,
		carbs:    8.5,
		fat:      1.5,
		adviceRu: "Клетчатка и микроэлементы для идеального пищеварения.",
		adviceUz: "Hazm qilish va vitaminlar uchun kletchatka.",
		adviceEn: "Fiber, antioxidants, and micronutrients for optimal gut health.",
	},
}

// AnalyzeMealText parses a free-form meal text description into structured macro analysis.
func (r *RuleEngineProvider) AnalyzeMealText(ctx context.Context, description string, lang string) (coach.MealAnalysisResult, error) {
	if lang == "" {
		if containsCyrillic(description) {
			lang = "ru"
		} else if isUzbekText(description) {
			lang = "uz"
		} else {
			lang = "en"
		}
	}

	lower := strings.ToLower(description)

	// Split by delimiters like commas, semicolons, "и", "va", "and", "+", "\n"
	delims := regexp.MustCompile(`[,;\n\+]|\s+(?:и|va|and|bilan|c|со|с)\s+`)
	rawSegments := delims.Split(lower, -1)

	var detectedItems []coach.MealItem
	var totalCals int
	var totalP, totalC, totalF float64
	var matchedNames []string

	for _, seg := range rawSegments {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}

		// Detect quantity/multiplier like "2 яйца", "3 ta tuxum", "150г", "200g"
		multiplier := 1.0
		gramRegex := regexp.MustCompile(`(\d+)\s*(?:g|г|гр|gram|gramm)`)
		numRegex := regexp.MustCompile(`^(\d+)\s*(?:шт|ta|pcs|dona)?`)

		if gMatch := gramRegex.FindStringSubmatch(seg); len(gMatch) > 1 {
			if grams, err := strconv.ParseFloat(gMatch[1], 64); err == nil && grams > 0 {
				multiplier = grams / 100.0 // relative to 100g standard
			}
		} else if nMatch := numRegex.FindStringSubmatch(seg); len(nMatch) > 1 {
			if num, err := strconv.ParseFloat(nMatch[1], 64); err == nil && num > 0 {
				multiplier = num
			}
		}

		for _, food := range knownFoods {
			matched := false
			for _, kw := range food.keywords {
				if strings.Contains(seg, kw) {
					matched = true
					break
				}
			}

			if matched {
				name := food.nameRu
				if lang == "uz" {
					name = food.nameUz
				} else if lang == "en" {
					name = food.nameEn
				}

				portionStr := fmt.Sprintf("%.0fg", food.baseG*multiplier)
				if multiplier == 1.0 {
					portionStr = fmt.Sprintf("%.0fg", food.baseG)
				}

				cals := int(float64(food.calories) * multiplier)
				prot := round1(food.protein * multiplier)
				carb := round1(food.carbs * multiplier)
				fat := round1(food.fat * multiplier)

				detectedItems = append(detectedItems, coach.MealItem{
					Name:     name,
					Portion:  portionStr,
					Calories: cals,
					ProteinG: prot,
					CarbsG:   carb,
					FatG:     fat,
				})

				totalCals += cals
				totalP += prot
				totalC += carb
				totalF += fat
				matchedNames = append(matchedNames, name)
				break
			}
		}
	}

	if len(detectedItems) > 0 {
		mealTitle := strings.Join(matchedNames, " + ")
		if len(mealTitle) > 60 {
			mealTitle = mealTitle[:57] + "..."
		}

		desc := fmt.Sprintf("Оценка рациона: %s.", strings.Join(matchedNames, ", "))
		advice := "Сбалансированный прием пищи с качественным распределением макронутриентов."
		if lang == "uz" {
			desc = fmt.Sprintf("Ovqatlanish tahlili: %s.", strings.Join(matchedNames, ", "))
			advice = "Mushaklarni oziqlantirish va tiklanish uchun optimal muvozanatli taom."
		} else if lang == "en" {
			desc = fmt.Sprintf("Meal breakdown: %s.", strings.Join(matchedNames, ", "))
			advice = "Well-balanced macro split supporting recovery and lean muscle tissue."
		}

		return coach.MealAnalysisResult{
			MealName:          mealTitle,
			VisualDescription: desc,
			Items:             detectedItems,
			TotalCalories:     totalCals,
			TotalProteinG:     round1(totalP),
			TotalCarbsG:       round1(totalC),
			TotalFatG:         round1(totalF),
			Confidence:        "high",
			HealthScore:       9,
			Advice:            advice,
		}, nil
	}

	// Fallback single item analysis if multi-segment parsing didn't match
	if res, ok := r.AnalyzeFoodItem(description); ok {
		return res, nil
	}

	// Generic fallback response with editable defaults
	defaultName := "Полноценный прием пищи"
	defaultDesc := fmt.Sprintf("Оценка рациона по описанию: «%s». Вы можете отредактировать граммовки перед сохранением.", description)
	defaultAdvice := "Следите за достаточным количеством белка (не менее 30г на прием) и сложными углеводами."

	if lang == "uz" {
		defaultName = "To'yimli taom"
		defaultDesc = fmt.Sprintf("Tavsif bo'yicha hisoblangan taom: «%s». Saqlashdan oldin o'zgartirishingiz mumkin.", description)
		defaultAdvice = "Har bir taomda kamida 25-30g sifatli oqsil bo'lishini ta'minlang."
	} else if lang == "en" {
		defaultName = "Balanced Fitness Meal"
		defaultDesc = fmt.Sprintf("Estimated from description: \"%s\". You can adjust values before logging.", description)
		defaultAdvice = "Ensure at least 30g of high-quality protein per meal for optimal recovery."
	}

	return coach.MealAnalysisResult{
		MealName:          defaultName,
		VisualDescription: defaultDesc,
		Items: []coach.MealItem{
			{
				Name:     defaultName,
				Portion:  "300g",
				Calories: 450,
				ProteinG: 32.0,
				CarbsG:   50.0,
				FatG:     12.0,
			},
		},
		TotalCalories: 450,
		TotalProteinG: 32.0,
		TotalCarbsG:   50.0,
		TotalFatG:     12.0,
		Confidence:    "medium",
		HealthScore:   8,
		Advice:        defaultAdvice,
	}, nil
}

func (r *RuleEngineProvider) AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes, lang string) (coach.MealAnalysisResult, error) {
	if notes != "" {
		return r.AnalyzeMealText(ctx, notes, lang)
	}
	return r.AnalyzeMealText(ctx, "Сбалансированное блюдо", lang)
}

func (r *RuleEngineProvider) AnalyzeFoodItem(text string) (coach.MealAnalysisResult, bool) {
	res, err := r.AnalyzeMealText(context.Background(), text, "ru")
	if err == nil && len(res.Items) > 0 {
		return res, true
	}
	return coach.MealAnalysisResult{}, false
}

func round1(val float64) float64 {
	return float64(int(val*10+0.5)) / 10.0
}

func containsCyrillic(s string) bool {
	for _, r := range s {
		if (r >= 'а' && r <= 'я') || (r >= 'А' && r <= 'Я') || r == 'ё' || r == 'Ё' {
			return true
		}
	}
	return false
}

func isUzbekText(s string) bool {
	lower := strings.ToLower(s)
	uzbekMarkers := []string{"salom", "osh", "palov", "somsa", "qanday", "manti", "non", "bo'tqa", "tuxum", "go'sht", "mashq", "kerak", "rahmat", "va", "bilan"}
	for _, m := range uzbekMarkers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}
