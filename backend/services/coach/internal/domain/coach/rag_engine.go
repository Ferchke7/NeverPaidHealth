package coach

import (
	"sort"
	"strings"
)

type synonymGroup struct {
	canonical string
	muscle    string
	terms     []string
}

var exerciseSynonymGraph = []synonymGroup{
	{
		canonical: "bench press",
		muscle:    "Chest",
		terms:     []string{"жим лежа", "жим штанги", "жиме", "жим на горизонтальной", "жим гантелей", "грудь", "грудные", "bench", "chest", "incline press", "dumbbell press", "ko'krak", "jim"},
	},
	{
		canonical: "squat",
		muscle:    "Legs",
		terms:     []string{"присед", "приседания", "приседе", "жим ногами", "гакк", "выпады", "квадрицепс", "ноги", "squat", "leg press", "lunge", "quad", "legs", "oyoq"},
	},
	{
		canonical: "deadlift",
		muscle:    "Back",
		terms:     []string{"становая", "становой", "тяга становая", "румынская", "мертвая тяга", "deadlift", "romanian", "rdl"},
	},
	{
		canonical: "back row & pull",
		muscle:    "Back",
		terms:     []string{"подтягиван", "тяга штанги", "тяга верхнего", "тяга горизонтального", "тяга в наклоне", "тяга гантели", "спина", "широчайш", "pull-up", "pull up", "chin-up", "lat pulldown", "row", "back", "lats", "orqa", "tortish"},
	},
	{
		canonical: "shoulder press & raises",
		muscle:    "Shoulders",
		terms:     []string{"армейский", "жим стоя", "жим сидя", "махи", "плечи", "дельт", "протяжка", "overhead", "military", "shoulder", "lateral raise", "delt", "yelka"},
	},
	{
		canonical: "arms curl & extension",
		muscle:    "Arms",
		terms:     []string{"бицепс", "трицепс", "сгибания на бицепс", "молотки", "разгибания на трицепс", "французский жим", "брусья", "руки", "bicep", "tricep", "curl", "extension", "skullcrusher", "dip", "qo'l"},
	},
}

// RetrieveHybridRAGContext executes a dual-retriever RAG pipeline over:
// 1. Personal Episodic Memory (90-day exercise & session timeline matched to user query or top movements),
// 2. Curated Sports Science Knowledge Base (BM25/keyword & intent scored chunks).
func RetrieveHybridRAGContext(query string, telemetry CoachInsights) RAGRetrievedContext {
	lowerQuery := strings.ToLower(strings.TrimSpace(query))

	intent := detectQueryIntent(lowerQuery)

	// 1. Personal Episodic Memory Retrieval
	matchedExercises := make([]string, 0)
	episodicLogs := make([]ExerciseSessionEntry, 0)
	seenKeys := make(map[string]bool)

	if telemetry.ExerciseTimeline != nil {
		// Determine which synonym groups or direct exercise names match the user's message
		targetMuscles := make(map[string]bool)
		targetTerms := make([]string, 0)

		for _, sg := range exerciseSynonymGraph {
			for _, term := range sg.terms {
				if strings.Contains(lowerQuery, term) {
					targetMuscles[sg.muscle] = true
					targetTerms = append(targetTerms, sg.terms...)
					break
				}
			}
		}

		// Search athlete's ExerciseTimeline for direct query matches or synonym matches
		for exKey, entries := range telemetry.ExerciseTimeline {
			if len(entries) == 0 {
				continue
			}
			exNameLower := strings.ToLower(entries[0].ExerciseName)
			muscle := entries[0].MuscleGroup

			matched := false
			// Direct substring match between query words and exercise name
			for _, word := range strings.Fields(lowerQuery) {
				cleanWord := strings.Trim(word, ".,!?:;\"'()[]")
				if len([]rune(cleanWord)) >= 4 && strings.Contains(exNameLower, cleanWord) {
					matched = true
					break
				}
			}
			if !matched && targetMuscles[muscle] {
				matched = true
			}
			if !matched {
				for _, t := range targetTerms {
					if strings.Contains(exNameLower, t) {
						matched = true
						break
					}
				}
			}

			if matched && !seenKeys[exKey] {
				seenKeys[exKey] = true
				matchedExercises = append(matchedExercises, entries[0].ExerciseName)
				// Include up to 6 chronological sessions for this matched exercise
				limit := len(entries)
				if limit > 6 {
					limit = 6
				}
				episodicLogs = append(episodicLogs, entries[:limit]...)
			}
		}

		// If the user asked a general question ("проанализируй прогресс", "что тренировать", "как мои дела"),
		// retrieve the top 5 most frequently trained exercises' latest progression curves so the LLM has full longitudinal context.
		if len(episodicLogs) == 0 {
			type exFreq struct {
				key     string
				entries []ExerciseSessionEntry
			}
			allEx := make([]exFreq, 0, len(telemetry.ExerciseTimeline))
			for k, v := range telemetry.ExerciseTimeline {
				if len(v) > 0 {
					allEx = append(allEx, exFreq{key: k, entries: v})
				}
			}
			sort.Slice(allEx, func(i, j int) bool {
				if len(allEx[i].entries) != len(allEx[j].entries) {
					return len(allEx[i].entries) > len(allEx[j].entries)
				}
				return allEx[i].entries[0].Date.After(allEx[j].entries[0].Date)
			})

			maxEx := len(allEx)
			if maxEx > 5 {
				maxEx = 5
			}
			for i := 0; i < maxEx; i++ {
				entries := allEx[i].entries
				matchedExercises = append(matchedExercises, entries[0].ExerciseName)
				limit := len(entries)
				if limit > 4 {
					limit = 4
				}
				episodicLogs = append(episodicLogs, entries[:limit]...)
			}
		}
	}

	// 2. Scientific Knowledge Base Retrieval (BM25-inspired keyword + telemetry-aware scoring)
	type scoredChunk struct {
		chunk KnowledgeChunk
		score float64
	}
	scored := make([]scoredChunk, 0, len(SportsScienceKnowledgeBase))

	for _, kb := range SportsScienceKnowledgeBase {
		score := 0.0
		for _, kw := range kb.Keywords {
			if strings.Contains(lowerQuery, kw) {
				score += 3.0
			}
		}
		// Boost based on detected intent
		if kb.Category == intent {
			score += 4.5
		}
		// Contextual boosts from athlete's physiological state
		if kb.ID == "kb_recomposition_high_bmi" && (telemetry.BMI >= 27.0 || telemetry.CurrentWeightKg >= 95.0) {
			score += 2.5
		}
		if kb.ID == "kb_plateau_deload" && len(telemetry.PlateauAlerts) > 0 {
			score += 2.0
		}
		if kb.ID == "kb_cns_acwr_fatigue" && (telemetry.CNS.ReadinessScore < 75 || telemetry.CNS.ACWR > 1.3) {
			score += 2.5
		}
		if kb.ID == "kb_double_progression_dup" {
			score += 1.5 // Always valuable baseline for strength coaching
		}
		scored = append(scored, scoredChunk{chunk: kb, score: score})
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	topChunks := make([]KnowledgeChunk, 0, 3)
	for i := 0; i < len(scored) && i < 3; i++ {
		topChunks = append(topChunks, scored[i].chunk)
	}

	return RAGRetrievedContext{
		DetectedIntent:       intent,
		MatchedExercises:     matchedExercises,
		EpisodicLogs:         episodicLogs,
		ScientificReferences: topChunks,
	}
}

func detectQueryIntent(q string) string {
	switch {
	case strings.Contains(q, "плато") || strings.Contains(q, "застой") || strings.Contains(q, "не растет") || strings.Contains(q, "plateau") || strings.Contains(q, "stuck"):
		return "PLATEAU"
	case strings.Contains(q, "цнс") || strings.Contains(q, "устал") || strings.Contains(q, "восстанов") || strings.Contains(q, "отдых") || strings.Contains(q, "сон") || strings.Contains(q, "recovery") || strings.Contains(q, "fatigue") || strings.Contains(q, "tiklanish"):
		return "RECOVERY"
	case strings.Contains(q, "белок") || strings.Contains(q, "калор") || strings.Contains(q, "питан") || strings.Contains(q, "диет") || strings.Contains(q, "похуд") || strings.Contains(q, "вес") || strings.Contains(q, "protein") || strings.Contains(q, "diet") || strings.Contains(q, "calorie") || strings.Contains(q, "oqsil") || strings.Contains(q, "ovqat"):
		return "NUTRITION"
	case strings.Contains(q, "техник") || strings.Contains(q, "жим") || strings.Contains(q, "присед") || strings.Contains(q, "станов") || strings.Contains(q, "bench") || strings.Contains(q, "squat") || strings.Contains(q, "deadlift"):
		return "BIOMECHANICS"
	case strings.Contains(q, "объем") || strings.Contains(q, "сколько подход") || strings.Contains(q, "мышц") || strings.Contains(q, "сплит") || strings.Contains(q, "volume") || strings.Contains(q, "hypertrophy"):
		return "HYPERTROPHY"
	default:
		return "PROGRESSION"
	}
}
