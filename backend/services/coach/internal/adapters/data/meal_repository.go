package data

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type MealRepository struct {
	pool *pgxpool.Pool
}

func NewMealRepository(pool *pgxpool.Pool) *MealRepository {
	repo := &MealRepository{pool: pool}
	if pool != nil {
		go repo.autoMigrate(context.Background())
	}
	return repo
}

func (r *MealRepository) autoMigrate(ctx context.Context) {
	if r.pool == nil {
		return
	}
	query := `
		CREATE TABLE IF NOT EXISTS meals (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			meal_type VARCHAR(50) NOT NULL DEFAULT 'meal',
			name VARCHAR(255) NOT NULL,
			calories INT NOT NULL,
			protein_g NUMERIC(6, 1) NOT NULL DEFAULT 0,
			carbs_g NUMERIC(6, 1) NOT NULL DEFAULT 0,
			fat_g NUMERIC(6, 1) NOT NULL DEFAULT 0,
			photo_url TEXT,
			items JSONB NOT NULL DEFAULT '[]',
			logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_meals_user_logged ON meals(user_id, logged_at DESC);
	`
	_, _ = r.pool.Exec(ctx, query)
}

func (r *MealRepository) SaveMeal(ctx context.Context, meal coach.MealLog) error {
	if r.pool == nil {
		return nil
	}

	itemsBytes, err := json.Marshal(meal.Items)
	if err != nil {
		itemsBytes = []byte("[]")
	}

	query := `
		INSERT INTO meals (id, user_id, meal_type, name, calories, protein_g, carbs_g, fat_g, photo_url, items, logged_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			calories = EXCLUDED.calories,
			protein_g = EXCLUDED.protein_g,
			carbs_g = EXCLUDED.carbs_g,
			fat_g = EXCLUDED.fat_g,
			photo_url = EXCLUDED.photo_url,
			items = EXCLUDED.items,
			logged_at = EXCLUDED.logged_at;
	`
	_, err = r.pool.Exec(
		ctx,
		query,
		meal.ID,
		meal.UserID,
		meal.MealType,
		meal.Name,
		meal.Calories,
		meal.ProteinG,
		meal.CarbsG,
		meal.FatG,
		meal.PhotoURL,
		itemsBytes,
		meal.LoggedAt,
		meal.CreatedAt,
	)
	return err
}

func (r *MealRepository) GetTodayMeals(ctx context.Context, userID uuid.UUID) ([]coach.MealLog, error) {
	if r.pool == nil {
		return []coach.MealLog{}, nil
	}

	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := `
		SELECT id, user_id, meal_type, name, calories, protein_g, carbs_g, fat_g, COALESCE(photo_url, ''), items, logged_at, created_at
		FROM meals
		WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
		ORDER BY logged_at ASC
	`
	rows, err := r.pool.Query(ctx, query, userID, startOfDay, endOfDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var meals []coach.MealLog
	for rows.Next() {
		var (
			m          coach.MealLog
			itemsBytes []byte
		)
		if err := rows.Scan(
			&m.ID,
			&m.UserID,
			&m.MealType,
			&m.Name,
			&m.Calories,
			&m.ProteinG,
			&m.CarbsG,
			&m.FatG,
			&m.PhotoURL,
			&itemsBytes,
			&m.LoggedAt,
			&m.CreatedAt,
		); err == nil {
			_ = json.Unmarshal(itemsBytes, &m.Items)
			meals = append(meals, m)
		}
	}
	return meals, nil
}

func (r *MealRepository) DeleteMeal(ctx context.Context, userID, mealID uuid.UUID) error {
	if r.pool == nil {
		return nil
	}
	query := `DELETE FROM meals WHERE id = $1 AND user_id = $2`
	_, err := r.pool.Exec(ctx, query, mealID, userID)
	return err
}
