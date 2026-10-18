package coach

import (
	"time"

	"github.com/google/uuid"
)

type InsightCategory string

const (
	CategoryOverload   InsightCategory = "OVERLOAD"
	CategoryRecovery   InsightCategory = "RECOVERY"
	CategoryPlateau    InsightCategory = "PLATEAU"
	CategoryBalance    InsightCategory = "BALANCE"
	CategoryMotivation InsightCategory = "MOTIVATION"
)

type InsightSeverity string

const (
	SeverityInfo    InsightSeverity = "INFO"
	SeveritySuccess InsightSeverity = "SUCCESS"
	SeverityWarning InsightSeverity = "WARNING"
)

type Insight struct {
	ID         string          `json:"id"`
	Category   InsightCategory `json:"category"`
	Severity   InsightSeverity `json:"severity"`
	Title      string          `json:"title"`
	Message    string          `json:"message"`
	ActionItem string          `json:"action_item,omitempty"`
}

type MuscleVolume struct {
	MuscleName string  `json:"muscle_name"`
	TotalSets  int     `json:"total_sets"`
	VolumeKg   float64 `json:"volume_kg"`
	Percentage float64 `json:"percentage"`
}

type ProgressiveOverloadTarget struct {
	ExerciseID     uuid.UUID `json:"exercise_id"`
	ExerciseName   string    `json:"exercise_name"`
	LastBestWeight float64   `json:"last_best_weight_kg"`
	LastBestReps   int       `json:"last_best_reps"`
	TargetWeightKg float64   `json:"target_weight_kg"`
	TargetReps     int       `json:"target_reps"`
	Recommendation string    `json:"recommendation"`
}

type PlateauAlert struct {
	ExerciseID   uuid.UUID `json:"exercise_id"`
	ExerciseName string    `json:"exercise_name"`
	StagnantDays int       `json:"stagnant_days"`
	Current1RM   float64   `json:"current_1rm_kg"`
	Advice       string    `json:"advice"`
}

type WorkoutSessionSummary struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	StartedAt       time.Time `json:"started_at"`
	TotalVolumeKg   float64   `json:"total_volume_kg"`
	CompletedSets   int       `json:"completed_sets_count"`
	DurationSeconds int       `json:"duration_seconds"`
}

type RoutineSummary struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Notes     string    `json:"notes,omitempty"`
	Exercises []string  `json:"exercises"`
}

type WorkoutDetail struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	StartedAt       time.Time `json:"started_at"`
	TotalVolumeKg   float64   `json:"total_volume_kg"`
	CompletedSets   int       `json:"completed_sets_count"`
	DurationMinutes int       `json:"duration_minutes"`
	ExerciseSummary string    `json:"exercise_summary"`
}

type MealSummaryItem struct {
	Name     string  `json:"name"`
	Calories int     `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
	Time     string  `json:"time"`
}

type PersonalRecordItem struct {
	ExerciseID   uuid.UUID `json:"exercise_id"`
	ExerciseName string    `json:"exercise_name"`
	PRType       string    `json:"pr_type"`
	Value        float64   `json:"value"`
	Reps         int       `json:"reps,omitempty"`
	Estimated1RM float64   `json:"estimated_1rm_kg,omitempty"`
	MaxVolumeKg  float64   `json:"max_volume_kg,omitempty"`
	AchievedAt   time.Time `json:"achieved_at"`
}

// CNSMetrics represents the Banister Impulse-Response & ACWR physiological readiness state.
type CNSMetrics struct {
	ReadinessScore      int     `json:"readiness_score"`
	RecoveryStatus      string  `json:"recovery_status"`
	AcuteLoad7dKg       float64 `json:"acute_load_7d_kg"`
	ChronicLoad28dAvgKg float64 `json:"chronic_load_28d_avg_kg"`
	ACWR                float64 `json:"acwr"`
	ACWRZone            string  `json:"acwr_zone"`
	AxialFatigueIndex   float64 `json:"axial_fatigue_index"`
	SystemicFatiguePct  float64 `json:"systemic_fatigue_pct"`
	HoursSinceLastTrain float64 `json:"hours_since_last_train"`
	RecommendedCooldown int     `json:"recommended_cooldown_hours"`
	ScientificRationale string  `json:"scientific_rationale"`
}

// MuscleRecoveryStatus models per-muscle recovery kinetic decay and Israetel volume landmarks.
type MuscleRecoveryStatus struct {
	MuscleGroup       string  `json:"muscle_group"`
	HoursSinceTrained float64 `json:"hours_since_trained"`
	RecoveryPercent   int     `json:"recovery_percent"`
	WeeklySets7d      int     `json:"weekly_sets_7d"`
	WeeklySets28dAvg  float64 `json:"weekly_sets_28d_avg"`
	VolumeStatus      string  `json:"volume_status"` // "Below MEV", "Optimal (MAV)", "Approaching MRV", "Overreaching (>MRV)"
	MEV               int     `json:"mev"`
	MAV               int     `json:"mav"`
	MRV               int     `json:"mrv"`
}

// ActiveSplitInfo holds the user's currently installed & active multi-day program.
type ActiveSplitInfo struct {
	ProgramID        uuid.UUID `json:"program_id"`
	ProgramName      string    `json:"program_name"`
	SplitType        string    `json:"split_type"`
	DaysPerWeek      int       `json:"days_per_week"`
	Level            string    `json:"level"`
	CurrentDayIndex  int       `json:"current_day_index"`
	NextDayName      string    `json:"next_day_name"`
	NextDayExercises []string  `json:"next_day_exercises"`
	AllDaysSummary   []string  `json:"all_days_summary,omitempty"`
}

// BodyCompositionSummary holds longitudinal body weight moving averages, circumferences, and recomp targets.
type BodyCompositionSummary struct {
	CurrentWeightKg   float64 `json:"current_weight_kg"`
	Weight7dSMA       float64 `json:"weight_7d_sma_kg,omitempty"`
	WeightDelta30dKg  float64 `json:"weight_delta_30d_kg,omitempty"`
	HeightCm          float64 `json:"height_cm,omitempty"`
	BMI               float64 `json:"bmi,omitempty"`
	BodyFatPercentage float64 `json:"body_fat_percentage,omitempty"`
	LeanBodyMassKg    float64 `json:"lean_body_mass_kg,omitempty"`
	WaistCm           float64 `json:"waist_cm,omitempty"`
	ChestCm           float64 `json:"chest_cm,omitempty"`
	ArmsCm            float64 `json:"arms_cm,omitempty"`
	ThighsCm          float64 `json:"thighs_cm,omitempty"`
	NeckCm            float64 `json:"neck_cm,omitempty"`
	ProteinTargetMinG float64 `json:"protein_target_min_g"`
	ProteinTargetMaxG float64 `json:"protein_target_max_g"`
	EstimatedTDEE     int     `json:"estimated_tdee_kcal"`
	RecommendedKcal   int     `json:"recommended_kcal"`
	NutritionalGoal   string  `json:"nutritional_goal"`
}

// NutritionTrendSummary holds 14-day nutrition adherence and macro averages.
type NutritionTrendSummary struct {
	DaysLogged14d  int     `json:"days_logged_14d"`
	AvgCalories14d int     `json:"avg_calories_14d"`
	AvgProtein14dG float64 `json:"avg_protein_14d_g"`
	AvgCarbs14dG   float64 `json:"avg_carbs_14d_g"`
	AvgFat14dG     float64 `json:"avg_fat_14d_g"`
}

// MonthlyVolumeSummary aggregates 30-day blocks over the 90-day macrocycle.
type MonthlyVolumeSummary struct {
	PeriodLabel    string  `json:"period_label"`
	WorkoutsCount  int     `json:"workouts_count"`
	TotalVolumeKg  float64 `json:"total_volume_kg"`
	TotalSets      int     `json:"total_sets"`
	AvgSessionVol  float64 `json:"avg_session_volume_kg"`
}

// ExerciseSessionEntry stores a single chronological workout performance for an exercise (used by Episodic RAG).
type ExerciseSessionEntry struct {
	ExerciseName string    `json:"exercise_name"`
	MuscleGroup  string    `json:"muscle_group"`
	WorkoutName  string    `json:"workout_name"`
	Date         time.Time `json:"date"`
	BestWeightKg float64   `json:"best_weight_kg"`
	BestReps     int       `json:"best_reps"`
	BestE1RMKg   float64   `json:"best_e1rm_kg"`
	TotalSets    int       `json:"total_sets"`
	VolumeKg     float64   `json:"volume_kg"`
	SetsDetail   string    `json:"sets_detail"`
}

// KnowledgeChunk represents an evidence-based sports science reference document for RAG.
type KnowledgeChunk struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Category string   `json:"category"`
	Keywords []string `json:"keywords"`
	Content  string   `json:"content"`
}

// RAGRetrievedContext contains the dynamically retrieved episodic and scientific context for a specific chat turn.
type RAGRetrievedContext struct {
	DetectedIntent       string                 `json:"detected_intent"`
	MatchedExercises     []string               `json:"matched_exercises,omitempty"`
	EpisodicLogs         []ExerciseSessionEntry `json:"episodic_logs,omitempty"`
	ScientificReferences []KnowledgeChunk       `json:"scientific_references,omitempty"`
}

type CoachInsights struct {
	ReadinessScore        int                         `json:"readiness_score"`      // 0 - 100
	RecoveryStatus        string                      `json:"recovery_status"`      // "Fully Recovered", "Optimal", "Fatigued", "Deload Recommended"
	WeeklyWorkoutsCount   int                         `json:"weekly_workouts_count"`
	WeeklyVolumeKg        float64                     `json:"weekly_volume_kg"`
	MonthlyWorkoutsCount  int                         `json:"monthly_workouts_count"`
	MonthlyVolumeKg       float64                     `json:"monthly_volume_kg"`
	TotalWorkouts90d      int                         `json:"total_workouts_90d"`
	DaysSinceLastTrain    int                         `json:"days_since_last_train"`
	SuggestedSplit        string                      `json:"suggested_split"`
	CurrentWeightKg       float64                     `json:"current_weight_kg,omitempty"`
	BodyFatPercentage     float64                     `json:"body_fat_percentage,omitempty"`
	BMI                   float64                     `json:"bmi,omitempty"`
	TodayCalories         int                         `json:"today_calories,omitempty"`
	TodayProteinG         float64                     `json:"today_protein_g,omitempty"`
	TodayCarbsG           float64                     `json:"today_carbs_g,omitempty"`
	TodayFatG             float64                     `json:"today_fat_g,omitempty"`
	OverloadTargets       []ProgressiveOverloadTarget `json:"overload_targets"`
	PlateauAlerts         []PlateauAlert              `json:"plateau_alerts"`
	MuscleDistribution    []MuscleVolume              `json:"muscle_distribution"`
	Insights              []Insight                   `json:"insights"`
	RecentTopPRs          []PersonalRecordItem        `json:"recent_top_prs,omitempty"`
	AllTimePRs            []PersonalRecordItem        `json:"all_time_prs,omitempty"`
	UserRoutines          []RoutineSummary            `json:"user_routines,omitempty"`
	RecentWorkouts        []WorkoutDetail             `json:"recent_workouts,omitempty"`
	TodayMeals            []MealSummaryItem           `json:"today_meals,omitempty"`
	GapsAndWeaknesses     []string                    `json:"gaps_and_weaknesses,omitempty"`
	CNS                   CNSMetrics                  `json:"cns_metrics"`
	MuscleRecovery        []MuscleRecoveryStatus      `json:"muscle_recovery,omitempty"`
	ActiveProgram         *ActiveSplitInfo            `json:"active_program,omitempty"`
	BodyComposition       *BodyCompositionSummary     `json:"body_composition,omitempty"`
	NutritionTrend        *NutritionTrendSummary      `json:"nutrition_trend,omitempty"`
	MonthlyVolumeHistory  []MonthlyVolumeSummary      `json:"monthly_volume_history,omitempty"`
	ExerciseTimeline      map[string][]ExerciseSessionEntry `json:"-"`
	RecommendedWorkout    *SuggestedWorkoutAction           `json:"recommended_workout,omitempty"`
	GeneratedAt           time.Time                         `json:"generated_at"`
}

type SuggestedExercise struct {
	ExerciseID     string  `json:"exercise_id,omitempty"`
	ExerciseName   string  `json:"exercise_name"`
	MuscleGroup    string  `json:"muscle_group,omitempty"`
	TargetSets     int     `json:"target_sets"`
	TargetReps     int     `json:"target_reps"`
	TargetWeightKg float64 `json:"target_weight_kg,omitempty"`
	RestSeconds    int     `json:"rest_seconds,omitempty"`
	Note           string  `json:"note,omitempty"`
}

type SuggestedWorkoutAction struct {
	Title        string              `json:"title"`
	Subtitle     string              `json:"subtitle,omitempty"`
	EstimatedMin int                 `json:"estimated_minutes"`
	TargetRIR    string              `json:"target_rir"`
	Exercises    []SuggestedExercise `json:"exercises"`
}

type ChatMessage struct {
	Role        string    `json:"role"` // "user" | "coach"
	Content     string    `json:"content"`
	ImageBase64 string    `json:"image_base64,omitempty"`
	MimeType    string    `json:"mime_type,omitempty"`
	SentAt      time.Time `json:"sent_at,omitempty"`
}

type ChatRequest struct {
	Message     string        `json:"message"`
	ImageBase64 string        `json:"image_base64,omitempty"`
	MimeType    string        `json:"mime_type,omitempty"`
	History     []ChatMessage `json:"history,omitempty"`
}

type ChatResponse struct {
	Reply            string                  `json:"reply"`
	Suggestions      []string                `json:"suggestions,omitempty"`
	SuggestedWorkout *SuggestedWorkoutAction `json:"suggested_workout,omitempty"`
}

