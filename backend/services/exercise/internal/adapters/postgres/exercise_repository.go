package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type ExerciseRepository struct {
	pool *pgxpool.Pool
}

func NewExerciseRepository(pool *pgxpool.Pool) *ExerciseRepository {
	return &ExerciseRepository{pool: pool}
}

func (r *ExerciseRepository) GetByID(ctx context.Context, id uuid.UUID) (*exercise.Exercise, error) {
	query := `
		SELECT id, name, primary_muscle_group, secondary_muscle_groups, equipment, measurement_type, is_custom, created_by_user_id
		FROM exercises WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanExercise(row)
}

func (r *ExerciseRepository) List(ctx context.Context, filter application.ExerciseFilter) ([]*exercise.Exercise, error) {
	query := `
		SELECT id, name, primary_muscle_group, secondary_muscle_groups, equipment, measurement_type, is_custom, created_by_user_id
		FROM exercises
		WHERE (is_custom = FALSE OR created_by_user_id = $1)
	`
	args := []any{filter.UserID}
	argIdx := 2

	if filter.MuscleGroup != nil {
		query += fmt.Sprintf(" AND primary_muscle_group = $%d", argIdx)
		args = append(args, filter.MuscleGroup.String())
		argIdx++
	}

	if filter.Equipment != nil {
		query += fmt.Sprintf(" AND equipment = $%d", argIdx)
		args = append(args, filter.Equipment.String())
		argIdx++
	}

	if filter.SearchQuery != "" {
		query += fmt.Sprintf(" AND LOWER(name) LIKE $%d", argIdx)
		args = append(args, "%"+strings.ToLower(filter.SearchQuery)+"%")
		argIdx++
	}

	query += " ORDER BY is_custom ASC, name ASC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*exercise.Exercise
	for rows.Next() {
		ex, err := scanExercise(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, ex)
	}

	return list, nil
}

func (r *ExerciseRepository) Save(ctx context.Context, ex *exercise.Exercise) error {
	secondaries := make([]string, 0)
	for _, s := range ex.SecondaryMuscleGroups() {
		secondaries = append(secondaries, s.String())
	}

	query := `
		INSERT INTO exercises (id, name, primary_muscle_group, secondary_muscle_groups, equipment, measurement_type, is_custom, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			primary_muscle_group = EXCLUDED.primary_muscle_group,
			secondary_muscle_groups = EXCLUDED.secondary_muscle_groups,
			equipment = EXCLUDED.equipment,
			measurement_type = EXCLUDED.measurement_type
	`
	_, err := r.pool.Exec(ctx, query,
		ex.ID(),
		ex.Name(),
		ex.PrimaryMuscleGroup().String(),
		secondaries,
		ex.Equipment().String(),
		ex.MeasurementType().String(),
		ex.IsCustom(),
		ex.CreatedByUserID(),
	)
	return err
}

func (r *ExerciseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM exercises WHERE id = $1 AND is_custom = TRUE`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func scanExercise(row pgx.Row) (*exercise.Exercise, error) {
	var (
		id              uuid.UUID
		name            string
		primaryStr      string
		secondariesStr  []string
		equipmentStr    string
		measurementStr  string
		isCustom        bool
		createdByUserID *uuid.UUID
	)

	err := row.Scan(&id, &name, &primaryStr, &secondariesStr, &equipmentStr, &measurementStr, &isCustom, &createdByUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, exercise.ErrExerciseNotFound
		}
		return nil, err
	}

	primary, err := exercise.NewMuscleGroup(primaryStr)
	if err != nil {
		return nil, err
	}

	var secondaries []exercise.MuscleGroup
	for _, s := range secondariesStr {
		sec, err := exercise.NewMuscleGroup(s)
		if err == nil {
			secondaries = append(secondaries, sec)
		}
	}

	equip, err := exercise.NewEquipment(equipmentStr)
	if err != nil {
		return nil, err
	}

	measure, err := exercise.NewMeasurementType(measurementStr)
	if err != nil {
		return nil, err
	}

	return exercise.Reconstitute(id, name, primary, secondaries, equip, measure, isCustom, createdByUserID), nil
}
