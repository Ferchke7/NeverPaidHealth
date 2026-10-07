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
	ExerciseID      uuid.UUID `json:"exercise_id"`
	ExerciseName    string    `json:"exercise_name"`
	LastBestWeight  float64   `json:"last_best_weight_kg"`
	LastBestReps    int       `json:"last_best_reps"`
	TargetWeightKg  float64   `json:"target_weight_kg"`
	TargetReps      int       `json:"target_reps"`
	Recommendation  string    `json:"recommendation"`
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

type PersonalRecordItem struct {
	ExerciseID   uuid.UUID `json:"exercise_id"`
	ExerciseName string    `json:"exercise_name"`
	PRType       string    `json:"pr_type"`
	Value        float64   `json:"value"`
	AchievedAt   time.Time `json:"achieved_at"`
}

type CoachInsights struct {
	ReadinessScore      int                         `json:"readiness_score"`      // 0 - 100
	RecoveryStatus      string                      `json:"recovery_status"`      // "Fully Recovered", "Optimal", "Fatigued", "Deload Recommended"
	WeeklyWorkoutsCount int                         `json:"weekly_workouts_count"`
	WeeklyVolumeKg      float64                     `json:"weekly_volume_kg"`
	DaysSinceLastTrain  int                         `json:"days_since_last_train"`
	SuggestedSplit      string                      `json:"suggested_split"`
	CurrentWeightKg     float64                     `json:"current_weight_kg,omitempty"`
	BodyFatPercentage   float64                     `json:"body_fat_percentage,omitempty"`
	BMI                 float64                     `json:"bmi,omitempty"`
	TodayCalories       int                         `json:"today_calories,omitempty"`
	TodayProteinG       float64                     `json:"today_protein_g,omitempty"`
	OverloadTargets     []ProgressiveOverloadTarget `json:"overload_targets"`
	PlateauAlerts       []PlateauAlert              `json:"plateau_alerts"`
	MuscleDistribution  []MuscleVolume              `json:"muscle_distribution"`
	Insights            []Insight                   `json:"insights"`
	RecentTopPRs        []PersonalRecordItem        `json:"recent_top_prs,omitempty"`
	GeneratedAt         time.Time                   `json:"generated_at"`
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
	Reply       string   `json:"reply"`
	Suggestions []string `json:"suggestions,omitempty"`
}
