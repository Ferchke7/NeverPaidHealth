package ai

import (
	"fmt"
	"strings"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

// formatAthleteProfileAndRAG builds a multi-horizon telemetry dossier + dynamically retrieved
// Hybrid RAG context (Episodic Exercise Timeline + Peer-Reviewed Sports Science Protocols).
func formatAthleteProfileAndRAG(telemetry coach.CoachInsights, ragCtx coach.RAGRetrievedContext, userName string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("=== 1. БИОМЕТРИЧЕСКИЙ ПРОФИЛЬ И СОСТАВ ТЕЛА АТЛЕТА (%s) ===\n", userName))
	if bc := telemetry.BodyComposition; bc != nil && bc.CurrentWeightKg > 0 {
		sb.WriteString(fmt.Sprintf("• Текущий вес: %.1f кг", bc.CurrentWeightKg))
		if bc.Weight7dSMA > 0 {
			sb.WriteString(fmt.Sprintf(" (7-дн. скользящее среднее: %.1f кг", bc.Weight7dSMA))
			if bc.WeightDelta30dKg != 0 {
				sign := ""
				if bc.WeightDelta30dKg > 0 {
					sign = "+"
				}
				sb.WriteString(fmt.Sprintf(", динамика за 30 дн.: %s%.1f кг", sign, bc.WeightDelta30dKg))
			}
			sb.WriteString(")")
		}
		if bc.HeightCm > 0 {
			sb.WriteString(fmt.Sprintf(" | Рост: %.0f см", bc.HeightCm))
		}
		if bc.BMI > 0 {
			sb.WriteString(fmt.Sprintf(" | ИМТ: %.1f", bc.BMI))
		}
		if bc.BodyFatPercentage > 0 {
			sb.WriteString(fmt.Sprintf(" | Жир: %.1f%%", bc.BodyFatPercentage))
		}
		if bc.LeanBodyMassKg > 0 {
			sb.WriteString(fmt.Sprintf(" | Сухая мышечная масса (LBM): ~%.1f кг", bc.LeanBodyMassKg))
		}
		sb.WriteString("\n")

		var circums []string
		if bc.WaistCm > 0 {
			circums = append(circums, fmt.Sprintf("Талия: %.1f см", bc.WaistCm))
		}
		if bc.ChestCm > 0 {
			circums = append(circums, fmt.Sprintf("Грудь: %.1f см", bc.ChestCm))
		}
		if bc.ArmsCm > 0 {
			circums = append(circums, fmt.Sprintf("Бицепс: %.1f см", bc.ArmsCm))
		}
		if bc.ThighsCm > 0 {
			circums = append(circums, fmt.Sprintf("Бедро: %.1f см", bc.ThighsCm))
		}
		if len(circums) > 0 {
			sb.WriteString(fmt.Sprintf("• Антропометрия (обхваты): %s\n", strings.Join(circums, " | ")))
		}
		sb.WriteString(fmt.Sprintf("• Научные целевые ориентиры питания (по LBM): Белок %.0f–%.0f г/сут | Поддержка (TDEE): ~%d ккал | Рекомендуемый калораж: %d ккал (%s)\n",
			bc.ProteinTargetMinG, bc.ProteinTargetMaxG, bc.EstimatedTDEE, bc.RecommendedKcal, bc.NutritionalGoal))
	} else if telemetry.CurrentWeightKg > 0 {
		sb.WriteString(fmt.Sprintf("• Текущий вес: %.1f кг | ИМТ: %.1f\n", telemetry.CurrentWeightKg, telemetry.BMI))
	} else {
		sb.WriteString("• Вес тела: еще не внесен в раздел «Тело»\n")
	}

	sb.WriteString("\n=== 2. ФИЗИОЛОГИЯ ЦНС (МОДЕЛЬ БАНИСТЕРА) И НАГРУЗКА (ACWR) ===\n")
	cns := telemetry.CNS
	sb.WriteString(fmt.Sprintf("• Готовность ЦНС (Readiness): %d/100 — %s\n", telemetry.ReadinessScore, telemetry.RecoveryStatus))
	sb.WriteString(fmt.Sprintf("• Детализация модели: %s\n", cns.ScientificRationale))
	sb.WriteString(fmt.Sprintf("• Тренировочный объем: за 7 дней = %d трен. (%.0f кг) | за 30 дней = %d трен. (%.0f кг) | всего за 90 дней = %d трен.\n",
		telemetry.WeeklyWorkoutsCount, telemetry.WeeklyVolumeKg, telemetry.MonthlyWorkoutsCount, telemetry.MonthlyVolumeKg, telemetry.TotalWorkouts90d))
	sb.WriteString(fmt.Sprintf("• Рекомендуемая тренировка на сегодня: %s\n", telemetry.SuggestedSplit))

	if len(telemetry.MuscleRecovery) > 0 {
		sb.WriteString("\n=== 3. МАТРИЦА ВОССТАНОВЛЕНИЯ МЫШЦ И ОБЪЕМНЫХ ОРИЕНТИРОВ (MEV/MAV/MRV) ===\n")
		for _, mr := range telemetry.MuscleRecovery {
			hrsStr := "не тренировалась >14д"
			if mr.HoursSinceTrained < 500 {
				hrsStr = fmt.Sprintf("%.0f ч назад", mr.HoursSinceTrained)
			}
			sb.WriteString(fmt.Sprintf("• %s: Восстановление %d%% (%s) | Подходов за 7д: %d (ср. за 28д: %.1f/нед) | Статус: %s [MEV:%d / MAV:%d / MRV:%d]\n",
				mr.MuscleGroup, mr.RecoveryPercent, hrsStr, mr.WeeklySets7d, mr.WeeklySets28dAvg, mr.VolumeStatus, mr.MEV, mr.MAV, mr.MRV))
		}
	}

	sb.WriteString("\n=== 4. АКТИВНАЯ ПРОГРАММА И СОХРАНЕННЫЕ ШАБЛОНЫ АТЛЕТА ===\n")
	if ap := telemetry.ActiveProgram; ap != nil {
		sb.WriteString(fmt.Sprintf("• АКТИВНАЯ ПРОГРАММА: «%s» (Сплит: %s, %d дн./нед, уровень: %s)\n",
			ap.ProgramName, ap.SplitType, ap.DaysPerWeek, ap.Level))
		if ap.NextDayName != "" {
			sb.WriteString(fmt.Sprintf("  Следующий день по расписанию (День %d — «%s»): %s\n",
				ap.CurrentDayIndex+1, ap.NextDayName, strings.Join(ap.NextDayExercises, ", ")))
		}
		if len(ap.AllDaysSummary) > 0 {
			sb.WriteString("  Структура сплита:\n")
			for _, d := range ap.AllDaysSummary {
				sb.WriteString(fmt.Sprintf("    - %s\n", d))
			}
		}
	}
	if len(telemetry.UserRoutines) > 0 {
		sb.WriteString("• Пользовательские шаблоны (Routines):\n")
		for i, r := range telemetry.UserRoutines {
			exList := "без упражнений"
			if len(r.Exercises) > 0 {
				exList = strings.Join(r.Exercises, ", ")
			}
			notes := ""
			if r.Notes != "" {
				notes = fmt.Sprintf(" (%s)", r.Notes)
			}
			sb.WriteString(fmt.Sprintf("  %d. «%s»%s -> [%s]\n", i+1, r.Name, notes, exList))
		}
	}

	sb.WriteString("\n=== 5. ЛИЧНЫЕ РЕКОРДЫ (ALL-TIME PRs) И РАСЧЕТНЫЙ 1RM ПО БЖИЦКИ ===\n")
	prs := telemetry.AllTimePRs
	if len(prs) == 0 {
		prs = telemetry.RecentTopPRs
	}
	if len(prs) > 0 {
		for _, pr := range prs {
			oneRMStr := ""
			if pr.Estimated1RM > 0 {
				oneRMStr = fmt.Sprintf(" | Расчетный 1RM (Brzycki): %.1f кг", pr.Estimated1RM)
			}
			dateStr := ""
			if !pr.AchievedAt.IsZero() {
				dateStr = fmt.Sprintf(" [%s]", pr.AchievedAt.Format("02.01.2006"))
			}
			sb.WriteString(fmt.Sprintf("• %s: лучший сет %s%s%s\n", pr.ExerciseName, pr.PRType, oneRMStr, dateStr))
		}
	} else {
		sb.WriteString("Зафиксированных рекордов пока нет.\n")
	}

	if len(telemetry.MonthlyVolumeHistory) > 0 {
		sb.WriteString("\n=== 6. ДИНАМИКА МАКРОЦИКЛА (90 ДНЕЙ) И ПОСЛЕДНИЕ ТРЕНИРОВКИ ===\n")
		for _, mh := range telemetry.MonthlyVolumeHistory {
			sb.WriteString(fmt.Sprintf("• %s: %d трен., тоннаж %.0f кг (%d раб. сетов, в среднем %.0f кг/трен.)\n",
				mh.PeriodLabel, mh.WorkoutsCount, mh.TotalVolumeKg, mh.TotalSets, mh.AvgSessionVol))
		}
	}

	if len(telemetry.RecentWorkouts) > 0 {
		sb.WriteString("Последние завершенные сессии:\n")
		limit := len(telemetry.RecentWorkouts)
		if limit > 8 {
			limit = 8
		}
		for i := 0; i < limit; i++ {
			w := telemetry.RecentWorkouts[i]
			dateStr := w.StartedAt.Format("02.01.2006")
			sb.WriteString(fmt.Sprintf("%d. «%s» (%s) — Тоннаж: %.0f кг, %d подх., %d мин. | %s\n",
				i+1, w.Name, dateStr, w.TotalVolumeKg, w.CompletedSets, w.DurationMinutes, w.ExerciseSummary))
		}
	}

	if len(ragCtx.EpisodicLogs) > 0 {
		sb.WriteString("\n=== 7. RAG: ХРОНОЛОГИЯ ПРОГРЕССИИ ПО ЗАПРОШЕННЫМ УПРАЖНЕНИЯМ (90 ДНЕЙ) ===\n")
		for _, log := range ragCtx.EpisodicLogs {
			sb.WriteString(fmt.Sprintf("• [%s] %s («%s»): подходы [%s] -> Лучший сет: %.1f кг × %d (e1RM: %.1f кг, объем: %.0f кг)\n",
				log.Date.Format("02.01.2006"), log.ExerciseName, log.WorkoutName, log.SetsDetail, log.BestWeightKg, log.BestReps, log.BestE1RMKg, log.VolumeKg))
		}
	}

	if len(telemetry.OverloadTargets) > 0 || len(telemetry.PlateauAlerts) > 0 {
		sb.WriteString("\n=== 8. МАТЕМАТИЧЕСКИЕ ЦЕЛИ ПРОГРЕССИИ (DOUBLE PROGRESSION) И ПЛАТО ===\n")
		for i, t := range telemetry.OverloadTargets {
			if i >= 10 {
				break
			}
			sb.WriteString(fmt.Sprintf("• %s: было %.1f кг × %d -> ЦЕЛЬ: %.1f кг × %d (%s)\n",
				t.ExerciseName, t.LastBestWeight, t.LastBestReps, t.TargetWeightKg, t.TargetReps, t.Recommendation))
		}
		for _, p := range telemetry.PlateauAlerts {
			sb.WriteString(fmt.Sprintf("⚠️ ПЛАТО в «%s» (%d дн., 1RM: %.1f кг): %s\n",
				p.ExerciseName, p.StagnantDays, p.Current1RM, p.Advice))
		}
	}

	sb.WriteString("\n=== 9. ТЕЛЕМЕТРИЯ ПИТАНИЯ (СЕГОДНЯ + ТРЕНД 14 ДНЕЙ) ===\n")
	if nt := telemetry.NutritionTrend; nt != nil && nt.DaysLogged14d > 0 {
		sb.WriteString(fmt.Sprintf("• Среднее за 14 дней (%d дн. учета): %d ккал/сут | Б: %.1f г | У: %.1f г | Ж: %.1f г\n",
			nt.DaysLogged14d, nt.AvgCalories14d, nt.AvgProtein14dG, nt.AvgCarbs14dG, nt.AvgFat14dG))
	}
	if telemetry.TodayCalories > 0 {
		sb.WriteString(fmt.Sprintf("• Съедено за сегодня: %d ккал | Б: %.1f г | У: %.1f г | Ж: %.1f г\n",
			telemetry.TodayCalories, telemetry.TodayProteinG, telemetry.TodayCarbsG, telemetry.TodayFatG))
		for _, m := range telemetry.TodayMeals {
			sb.WriteString(fmt.Sprintf("  - %s (%s): %d ккал (Б:%.1fг, У:%.1fг, Ж:%.1fг)\n",
				m.Name, m.Time, m.Calories, m.ProteinG, m.CarbsG, m.FatG))
		}
	} else {
		sb.WriteString("• За сегодня приемы пищи еще не записаны.\n")
	}

	if len(ragCtx.ScientificReferences) > 0 {
		sb.WriteString("\n=== 10. RAG: НАУЧНАЯ БАЗА ЗНАНИЙ (СПОРТИВНАЯ ФИЗИОЛОГИЯ И БИОМЕХАНИКА) ===\n")
		for _, ref := range ragCtx.ScientificReferences {
			sb.WriteString(ref.Content + "\n\n")
		}
	}

	return sb.String()
}
