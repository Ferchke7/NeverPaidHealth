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
		case strings.Contains(msg, "rekord") || strings.Contains(msg, "1rm"):
			reply.WriteString("🏆 **Shaxsiy rekordlar (Brzycki 1RM):**\n")
			if len(telemetry.AllTimePRs) > 0 {
				for i, pr := range telemetry.AllTimePRs {
					if i >= 4 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s:** %.1f kg × %d (1RM: **%.0f kg**)\n", pr.ExerciseName, pr.Value, pr.Reps, pr.Estimated1RM))
				}
			} else {
				reply.WriteString("• Hali rekordlar qayd etilmagan — birinchi mashg'ulotni yakunlang.")
			}
			suggestions = []string{"Bugun nima mashq qilamiz?", "Kunlik oqsil me'yori", "Tiklanish tahlili"}

		case strings.Contains(msg, "oqsil") || strings.Contains(msg, "ovqat") || strings.Contains(msg, "kaloriya") || strings.Contains(msg, "protein") || strings.Contains(msg, "bju"):
			if bc := telemetry.BodyComposition; bc != nil && bc.CurrentWeightKg > 0 {
				reply.WriteString(fmt.Sprintf("🥩 **Ratsion (%s — %.1f kg, LBM %.1f kg):**\n", bc.NutritionalGoal, bc.CurrentWeightKg, bc.LeanBodyMassKg))
				reply.WriteString(fmt.Sprintf("• **Kaloriya:** **%d kkal/kun** (TDEE: %d kkal)\n", bc.RecommendedKcal, bc.EstimatedTDEE))
				reply.WriteString(fmt.Sprintf("• **Oqsil (LBM bo'yicha):** **%.0f–%.0f g/kun** (bugun: %.0fg)\n", bc.ProteinTargetMinG, bc.ProteinTargetMaxG, telemetry.TodayProteinG))
				reply.WriteString("• **Suv va Kreatin:** 3.5 L suv + 5 g kreatin monohidrat.")
			} else {
				reply.WriteString("🥩 **Sport ovqatlanish me'yorlari:**\n• **Oqsil:** LBM ning 1 kg uchun **2.0–2.2 g**\n• **Uglevodlar:** **3–4 g/kg**\n• **Kreatin:** **5 g/kun**")
			}
			suggestions = []string{"Bugungi mashg'ulot rejasi", "Mening 1RM rekordlarim", "Asab tizimi (CNS) holati"}

		default:
			reply.WriteString(fmt.Sprintf("⚡ **CNS Tayyorligi:** **%d/100** (ACWR **%.2f**)\n", telemetry.ReadinessScore, telemetry.CNS.ACWR))
			reply.WriteString(fmt.Sprintf("• **Tavsiya:** `%s`\n", telemetry.SuggestedSplit))
			if len(telemetry.OverloadTargets) > 0 {
				for i, t := range telemetry.OverloadTargets {
					if i >= 3 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s:** bugungi maqsad **%.1f kg × %d**\n", t.ExerciseName, t.TargetWeightKg, t.TargetReps))
				}
			}
			suggestions = []string{"Mening 1RM rekordlarim", "Kunlik oqsil va kaloriya", "Tiklanish tahlili"}
		}

	case "en":
		switch {
		case strings.Contains(msg, "pr") || strings.Contains(msg, "record") || strings.Contains(msg, "1rm"):
			reply.WriteString("🏆 **Top Personal Records (Brzycki e1RM):**\n")
			if len(telemetry.AllTimePRs) > 0 {
				for i, pr := range telemetry.AllTimePRs {
					if i >= 4 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s:** %.1f kg × %d (e1RM: **%.0f kg**)\n", pr.ExerciseName, pr.Value, pr.Reps, pr.Estimated1RM))
				}
			} else {
				reply.WriteString("• No PRs logged yet — complete a workout to unlock e1RM tracking.")
			}
			suggestions = []string{"Today's workout plan", "My LBM macro targets", "CNS & volume status"}

		case strings.Contains(msg, "protein") || strings.Contains(msg, "diet") || strings.Contains(msg, "calorie") || strings.Contains(msg, "nutrition") || strings.Contains(msg, "macro"):
			if bc := telemetry.BodyComposition; bc != nil && bc.CurrentWeightKg > 0 {
				reply.WriteString(fmt.Sprintf("🥩 **Nutrition Targets (%.1f kg, LBM %.1f kg):**\n", bc.CurrentWeightKg, bc.LeanBodyMassKg))
				reply.WriteString(fmt.Sprintf("• **Target Intake:** **%d kcal/day** (TDEE: %d kcal)\n", bc.RecommendedKcal, bc.EstimatedTDEE))
				reply.WriteString(fmt.Sprintf("• **Protein (LBM-scaled):** **%.0f–%.0f g/day** (logged today: %.0fg)\n", bc.ProteinTargetMinG, bc.ProteinTargetMaxG, telemetry.TodayProteinG))
				reply.WriteString("• **Supplements:** 5g Creatine Monohydrate daily.")
			} else {
				reply.WriteString("🥩 **Macro Targets:**\n• **Protein:** **2.0–2.2g/kg LBM**\n• **Carbs:** **3–4g/kg**\n• **Creatine:** **5g/day**")
			}
			suggestions = []string{"What should I train today?", "My top PRs & e1RM", "CNS recovery analysis"}

		default:
			reply.WriteString(fmt.Sprintf("⚡ **CNS Readiness:** **%d/100** • ACWR **%.2f** (%s)\n", telemetry.ReadinessScore, telemetry.CNS.ACWR, telemetry.RecoveryStatus))
			reply.WriteString(fmt.Sprintf("• **Next Split:** `%s`\n", telemetry.SuggestedSplit))
			if len(telemetry.OverloadTargets) > 0 {
				for i, t := range telemetry.OverloadTargets {
					if i >= 3 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s:** aim for **%.1f kg × %d reps** (prev %.1fkg×%d)\n", t.ExerciseName, t.TargetWeightKg, t.TargetReps, t.LastBestWeight, t.LastBestReps))
				}
			}
			suggestions = []string{"My top PRs & e1RM", "Daily protein & calories", "Muscle recovery status"}
		}

	default: // Russian
		switch {
		case strings.Contains(msg, "рекорд") || strings.Contains(msg, "1rm") || strings.Contains(msg, "1пм") || strings.Contains(msg, "силов"):
			reply.WriteString("🏆 **Твои рекорды и расчетный 1RM (Бжицки):**\n")
			if len(telemetry.AllTimePRs) > 0 {
				for i, pr := range telemetry.AllTimePRs {
					if i >= 5 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s:** **%.1f кг × %d** → 1RM **%.1f кг**\n", pr.ExerciseName, pr.Value, pr.Reps, pr.Estimated1RM))
				}
			} else {
				reply.WriteString("• Рекорды еще не зафиксированы — заверши тренировку для расчета 1RM.")
			}
			suggestions = []string{"План на сегодня с весами", "Разбор восстановления ЦНС", "Мои КБЖУ по сухой массе"}

		case strings.Contains(msg, "восстановлен") || strings.Contains(msg, "цнс") || strings.Contains(msg, "объем") || strings.Contains(msg, "мышц"):
			reply.WriteString(fmt.Sprintf("🧬 **ЦНС Банистера:** **%d/100** • ACWR **%.2f** (7д: **%.0f кг** / 28д ср: **%.0f кг**)\n",
				telemetry.ReadinessScore, telemetry.CNS.ACWR, telemetry.CNS.AcuteLoad7dKg, telemetry.CNS.ChronicLoad28dAvgKg))
			for _, m := range telemetry.MuscleRecovery {
				if m.MuscleGroup == "Core" {
					continue
				}
				reply.WriteString(fmt.Sprintf("• **%s:** восст. **%d%%** | **%d сетов/нед** (норма MAV %d)\n", m.MuscleGroup, m.RecoveryPercent, m.WeeklySets7d, m.MAV))
			}
			suggestions = []string{"Что тренировать сегодня?", "Мои рекорды 1RM", "Точные КБЖУ для рекомпозиции"}

		case strings.Contains(msg, "белок") || strings.Contains(msg, "питан") || strings.Contains(msg, "калор") || strings.Contains(msg, "кбжу") || strings.Contains(msg, "вес"):
			if bc := telemetry.BodyComposition; bc != nil && bc.CurrentWeightKg > 0 {
				reply.WriteString(fmt.Sprintf("🥩 **Питание по сухой массе (Вес %.1f кг, LBM %.1f кг, ИМТ %.1f):**\n", bc.CurrentWeightKg, bc.LeanBodyMassKg, bc.BMI))
				reply.WriteString(fmt.Sprintf("• **Цель:** %s\n", bc.NutritionalGoal))
				reply.WriteString(fmt.Sprintf("• **Калории:** **%d ккал/день** (TDEE поддержки: %d ккал)\n", bc.RecommendedKcal, bc.EstimatedTDEE))
				reply.WriteString(fmt.Sprintf("• **Белок (на LBM):** **%.0f–%.0f г/день** (сегодня: **%.0f г** | %d ккал)", bc.ProteinTargetMinG, bc.ProteinTargetMaxG, telemetry.TodayProteinG, telemetry.TodayCalories))
			} else {
				reply.WriteString("🥩 **Цели по питанию:**\n• **Белок:** **2.0–2.2 г** на 1 кг сухой массы (LBM)\n• **Дефицит при сушке:** **-15..20%** от TDEE\n• Запиши вес в разделе «Тело» для точного расчета LBM.")
			}
			suggestions = []string{"Что тренировать сегодня?", "Разбор восстановления ЦНС", "Мои рекорды 1RM"}

		default:
			reply.WriteString(fmt.Sprintf("⚡ **Готовность ЦНС:** **%d/100** (ACWR **%.2f**) • Сплит: `%s`\n", telemetry.ReadinessScore, telemetry.CNS.ACWR, telemetry.SuggestedSplit))
			if len(telemetry.OverloadTargets) > 0 {
				for i, t := range telemetry.OverloadTargets {
					if i >= 3 {
						break
					}
					reply.WriteString(fmt.Sprintf("• **%s:** цель **%.1f кг × %d** (было %.1fкг×%d)\n", t.ExerciseName, t.TargetWeightKg, t.TargetReps, t.LastBestWeight, t.LastBestReps))
				}
			} else {
				reply.WriteString("• Работай в диапазоне **RIR 1–2** в базовых движениях.")
			}
			suggestions = []string{"Мои рекорды и 1RM", "Разбор ЦНС и объема мышц", "Мои КБЖУ для рекомпозиции"}
		}
	}

	return coach.ChatResponse{
		Reply:            strings.TrimSpace(reply.String()),
		Suggestions:      suggestions,
		SuggestedWorkout: coach.BuildWorkoutForChatQuery(req.Message, telemetry),
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
