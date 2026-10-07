package coach

import (
	"time"

	"github.com/google/uuid"
)

type MealItem struct {
	Name     string  `json:"name"`
	Portion  string  `json:"portion"`
	Calories int     `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

type MealAnalysisResult struct {
	MealName          string     `json:"meal_name"`
	VisualDescription string     `json:"visual_description,omitempty"`
	Items             []MealItem `json:"items"`
	TotalCalories     int        `json:"total_calories"`
	TotalProteinG     float64    `json:"total_protein_g"`
	TotalCarbsG       float64    `json:"total_carbs_g"`
	TotalFatG         float64    `json:"total_fat_g"`
	Confidence        string     `json:"confidence"`
	HealthScore       int        `json:"health_score"`
	Advice            string     `json:"advice"`
}

type MealLog struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	MealType  string     `json:"meal_type"` // "breakfast", "lunch", "dinner", "snack"
	Name      string     `json:"name"`
	Calories  int        `json:"calories"`
	ProteinG  float64    `json:"protein_g"`
	CarbsG    float64    `json:"carbs_g"`
	FatG      float64    `json:"fat_g"`
	PhotoURL  string     `json:"photo_url,omitempty"`
	Items     []MealItem `json:"items,omitempty"`
	LoggedAt  time.Time  `json:"logged_at"`
	CreatedAt time.Time  `json:"created_at"`
}

type DailyNutritionSummary struct {
	Date           string    `json:"date"`
	TotalCalories  int       `json:"total_calories"`
	TotalProteinG  float64   `json:"total_protein_g"`
	TotalCarbsG    float64   `json:"total_carbs_g"`
	TotalFatG      float64   `json:"total_fat_g"`
	TargetCalories int       `json:"target_calories"`
	TargetProteinG float64   `json:"target_protein_g"`
	TargetCarbsG   float64   `json:"target_carbs_g"`
	TargetFatG     float64   `json:"target_fat_g"`
	Meals          []MealLog `json:"meals"`
}
