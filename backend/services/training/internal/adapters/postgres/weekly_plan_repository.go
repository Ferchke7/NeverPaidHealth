package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/weeklyplan"
)

type WeeklyPlanRepository struct {
	pool *pgxpool.Pool
}

func NewWeeklyPlanRepository(pool *pgxpool.Pool) *WeeklyPlanRepository {
	repo := &WeeklyPlanRepository{pool: pool}
	if pool != nil {
		repo.InitSchema(context.Background())
	}
	return repo
}

func (r *WeeklyPlanRepository) InitSchema(ctx context.Context) {
	if r.pool == nil {
		return
	}
	schema := `
		CREATE TABLE IF NOT EXISTS user_weekly_plan_items (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
			order_index INT NOT NULL DEFAULT 0,
			item_type VARCHAR(32) NOT NULL DEFAULT 'routine',
			routine_id UUID,
			program_id UUID,
			program_day_number INT,
			title VARCHAR(255) NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			completed_week_start VARCHAR(20) NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_weekly_plan_user_day
			ON user_weekly_plan_items(user_id, day_of_week, order_index);
	`
	_, _ = r.pool.Exec(ctx, schema)
}

func (r *WeeklyPlanRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*weeklyplan.PlanItem, error) {
	if r.pool == nil {
		return nil, nil
	}
	query := `
		SELECT id, user_id, day_of_week, order_index, item_type,
		       routine_id, program_id, program_day_number,
		       title, notes, completed_week_start, created_at, updated_at
		FROM user_weekly_plan_items
		WHERE user_id = $1
		ORDER BY day_of_week ASC, order_index ASC, created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query weekly plan: %w", err)
	}
	defer rows.Close()

	var result []*weeklyplan.PlanItem
	for rows.Next() {
		var item weeklyplan.PlanItem
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.DayOfWeek,
			&item.OrderIndex,
			&item.ItemType,
			&item.RoutineID,
			&item.ProgramID,
			&item.ProgramDayNumber,
			&item.Title,
			&item.Notes,
			&item.CompletedWeekStart,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan weekly plan item: %w", err)
		}
		result = append(result, &item)
	}
	return result, nil
}

func (r *WeeklyPlanRepository) ReplaceAll(ctx context.Context, userID uuid.UUID, items []*weeklyplan.PlanItem) error {
	if r.pool == nil {
		return nil
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM user_weekly_plan_items WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("failed clearing weekly plan: %w", err)
	}

	ins := `
		INSERT INTO user_weekly_plan_items (
			id, user_id, day_of_week, order_index, item_type,
			routine_id, program_id, program_day_number,
			title, notes, completed_week_start, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8,
			$9, $10, $11, $12, $13
		)
	`
	for _, it := range items {
		if _, err := tx.Exec(
			ctx, ins,
			it.ID, userID, it.DayOfWeek, it.OrderIndex, it.ItemType,
			it.RoutineID, it.ProgramID, it.ProgramDayNumber,
			it.Title, it.Notes, it.CompletedWeekStart, it.CreatedAt, it.UpdatedAt,
		); err != nil {
			return fmt.Errorf("failed inserting weekly plan item: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *WeeklyPlanRepository) ReplaceRoutineDays(
	ctx context.Context,
	userID uuid.UUID,
	routineID uuid.UUID,
	title string,
	daysOfWeek []int,
) error {
	if r.pool == nil {
		return nil
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	wantSet := make(map[int]bool, len(daysOfWeek))
	for _, d := range daysOfWeek {
		wantSet[d] = true
	}

	rows, err := tx.Query(ctx, `
		SELECT id, day_of_week
		FROM user_weekly_plan_items
		WHERE user_id = $1 AND item_type = 'routine' AND routine_id = $2
	`, userID, routineID)
	if err != nil {
		return err
	}
	existingDayMap := make(map[int]bool)
	var removeIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		var dow int
		if sErr := rows.Scan(&id, &dow); sErr == nil {
			if wantSet[dow] && !existingDayMap[dow] {
				existingDayMap[dow] = true
			} else {
				removeIDs = append(removeIDs, id)
			}
		}
	}
	rows.Close()

	for _, id := range removeIDs {
		_, _ = tx.Exec(ctx, `DELETE FROM user_weekly_plan_items WHERE user_id = $1 AND id = $2`, userID, id)
	}

	now := time.Now().UTC()
	for _, d := range daysOfWeek {
		if existingDayMap[d] {
			_, _ = tx.Exec(ctx, `
				UPDATE user_weekly_plan_items
				SET title = $1, updated_at = $2
				WHERE user_id = $3 AND routine_id = $4 AND day_of_week = $5
			`, title, now, userID, routineID, d)
			continue
		}
		var nextIdx int
		_ = tx.QueryRow(ctx, `
			SELECT COALESCE(MAX(order_index) + 1, 0)
			FROM user_weekly_plan_items
			WHERE user_id = $1 AND day_of_week = $2
		`, userID, d).Scan(&nextIdx)

		_, err = tx.Exec(ctx, `
			INSERT INTO user_weekly_plan_items (
				id, user_id, day_of_week, order_index, item_type,
				routine_id, title, notes, completed_week_start, created_at, updated_at
			) VALUES ($1, $2, $3, $4, 'routine', $5, $6, '', '', $7, $7)
		`, uuid.New(), userID, d, nextIdx, routineID, title, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *WeeklyPlanRepository) SetCompletedWeek(
	ctx context.Context,
	userID uuid.UUID,
	itemID uuid.UUID,
	completedWeekStart string,
) error {
	if r.pool == nil {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE user_weekly_plan_items
		SET completed_week_start = $1, updated_at = NOW()
		WHERE user_id = $2 AND id = $3
	`, completedWeekStart, userID, itemID)
	return err
}
