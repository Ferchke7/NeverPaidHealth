package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
)

type ProgramRepository struct {
	pool *pgxpool.Pool
}

func NewProgramRepository(pool *pgxpool.Pool) *ProgramRepository {
	return &ProgramRepository{pool: pool}
}

type ExJSONItem struct {
	ExerciseID    uuid.UUID `json:"exercise_id"`
	ExerciseName  string    `json:"exercise_name"`
	OrderIndex    int       `json:"order_index"`
	TargetSets    int       `json:"target_sets"`
	TargetRepsMin *int      `json:"target_reps_min,omitempty"`
	TargetRepsMax *int      `json:"target_reps_max,omitempty"`
}

type DayJSONItem struct {
	DayNumber int          `json:"day_number"`
	Name      string       `json:"name"`
	Notes     string       `json:"notes,omitempty"`
	Exercises []ExJSONItem `json:"exercises"`
}

func (r *ProgramRepository) GetByID(ctx context.Context, id uuid.UUID) (*program.Program, error) {
	query := `
		SELECT id, user_id, name, description, split_type, days_per_week, level, is_public, author_name, likes_count, installs_count, days, created_at, updated_at
		FROM programs WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanProgram(row)
}

func (r *ProgramRepository) ListLibrary(ctx context.Context, splitType string, search string) ([]*program.Program, error) {
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, "user_id = '00000000-0000-0000-0000-000000000000'")

	if splitType != "" && splitType != "all" {
		conditions = append(conditions, fmt.Sprintf("split_type = $%d", argIdx))
		args = append(args, splitType)
		argIdx++
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT id, user_id, name, description, split_type, days_per_week, level, is_public, author_name, likes_count, installs_count, days, created_at, updated_at
		FROM programs
		WHERE %s
		ORDER BY created_at ASC
	`, strings.Join(conditions, " AND "))

	return r.queryPrograms(ctx, query, args...)
}

func (r *ProgramRepository) ListCommunity(ctx context.Context, splitType string, search string, limit int, offset int) ([]*program.Program, error) {
	if limit <= 0 {
		limit = 50
	}
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, "is_public = true")

	if splitType != "" && splitType != "all" {
		conditions = append(conditions, fmt.Sprintf("split_type = $%d", argIdx))
		args = append(args, splitType)
		argIdx++
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d OR author_name ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT id, user_id, name, description, split_type, days_per_week, level, is_public, author_name, likes_count, installs_count, days, created_at, updated_at
		FROM programs
		WHERE %s
		ORDER BY likes_count DESC, installs_count DESC, created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(conditions, " AND "), argIdx, argIdx+1)

	args = append(args, limit, offset)
	return r.queryPrograms(ctx, query, args...)
}

func (r *ProgramRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*program.Program, error) {
	query := `
		SELECT id, user_id, name, description, split_type, days_per_week, level, is_public, author_name, likes_count, installs_count, days, created_at, updated_at
		FROM programs
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	return r.queryPrograms(ctx, query, userID)
}

func (r *ProgramRepository) Save(ctx context.Context, p *program.Program) error {
	var daysJSON []DayJSONItem
	for _, d := range p.Days() {
		var exJSON []ExJSONItem
		for _, ex := range d.Exercises() {
			exJSON = append(exJSON, ExJSONItem{
				ExerciseID:    ex.ExerciseID(),
				ExerciseName:  ex.ExerciseName(),
				OrderIndex:    ex.OrderIndex(),
				TargetSets:    ex.TargetSets(),
				TargetRepsMin: ex.TargetRepsMin(),
				TargetRepsMax: ex.TargetRepsMax(),
			})
		}
		daysJSON = append(daysJSON, DayJSONItem{
			DayNumber: d.DayNumber(),
			Name:      d.Name(),
			Notes:     d.Notes(),
			Exercises: exJSON,
		})
	}

	rawDays, err := json.Marshal(daysJSON)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO programs (id, user_id, name, description, split_type, days_per_week, level, is_public, author_name, likes_count, installs_count, days, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			split_type = EXCLUDED.split_type,
			days_per_week = EXCLUDED.days_per_week,
			level = EXCLUDED.level,
			is_public = EXCLUDED.is_public,
			author_name = EXCLUDED.author_name,
			likes_count = EXCLUDED.likes_count,
			installs_count = EXCLUDED.installs_count,
			days = EXCLUDED.days,
			updated_at = EXCLUDED.updated_at
	`

	_, err = r.pool.Exec(ctx, query,
		p.ID(),
		p.UserID(),
		p.Name(),
		p.Description(),
		string(p.SplitType()),
		p.DaysPerWeek(),
		string(p.Level()),
		p.IsPublic(),
		p.AuthorName(),
		p.LikesCount(),
		p.InstallsCount(),
		rawDays,
		p.CreatedAt(),
		p.UpdatedAt(),
	)
	return err
}

func (r *ProgramRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM programs WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *ProgramRepository) queryPrograms(ctx context.Context, query string, args ...any) ([]*program.Program, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*program.Program
	for rows.Next() {
		p, err := scanProgram(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

// -------------------------------------------------------------
// User Program Repository
// -------------------------------------------------------------

type UserProgramRepository struct {
	pool *pgxpool.Pool
}

func NewUserProgramRepository(pool *pgxpool.Pool) *UserProgramRepository {
	return &UserProgramRepository{pool: pool}
}

func (r *UserProgramRepository) GetByID(ctx context.Context, id uuid.UUID) (*program.UserProgram, error) {
	query := `
		SELECT id, user_id, program_id, custom_name, is_active, current_day_index, installed_at
		FROM user_programs WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanUserProgram(row)
}

func (r *UserProgramRepository) GetActive(ctx context.Context, userID uuid.UUID) (*program.UserProgram, error) {
	query := `
		SELECT id, user_id, program_id, custom_name, is_active, current_day_index, installed_at
		FROM user_programs WHERE user_id = $1 AND is_active = true LIMIT 1
	`
	row := r.pool.QueryRow(ctx, query, userID)
	up, err := scanUserProgram(row)
	if err != nil {
		if errors.Is(err, program.ErrUserProgramNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return up, nil
}

func (r *UserProgramRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*program.UserProgram, error) {
	query := `
		SELECT id, user_id, program_id, custom_name, is_active, current_day_index, installed_at
		FROM user_programs WHERE user_id = $1 ORDER BY is_active DESC, installed_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*program.UserProgram
	for rows.Next() {
		up, err := scanUserProgram(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, up)
	}
	return list, nil
}

func (r *UserProgramRepository) Save(ctx context.Context, up *program.UserProgram) error {
	query := `
		INSERT INTO user_programs (id, user_id, program_id, custom_name, is_active, current_day_index, installed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			custom_name = EXCLUDED.custom_name,
			is_active = EXCLUDED.is_active,
			current_day_index = EXCLUDED.current_day_index
	`
	_, err := r.pool.Exec(ctx, query,
		up.ID(),
		up.UserID(),
		up.ProgramID(),
		up.CustomName(),
		up.IsActive(),
		up.CurrentDayIndex(),
		up.InstalledAt(),
	)
	return err
}

func (r *UserProgramRepository) SetActive(ctx context.Context, userID uuid.UUID, userProgramID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Set all user programs to false
	_, err = tx.Exec(ctx, `UPDATE user_programs SET is_active = false WHERE user_id = $1`, userID)
	if err != nil {
		return err
	}

	// Set selected to true
	_, err = tx.Exec(ctx, `UPDATE user_programs SET is_active = true WHERE id = $1 AND user_id = $2`, userProgramID, userID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *UserProgramRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM user_programs WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func scanProgram(row pgx.Row) (*program.Program, error) {
	var (
		id            uuid.UUID
		userID        uuid.UUID
		name          string
		description   *string
		splitTypeStr  string
		daysPerWeek   int
		levelStr      string
		isPublic      bool
		authorName    *string
		likesCount    int
		installsCount int
		daysJSON      []byte
		createdAt     time.Time
		updatedAt     time.Time
	)

	err := row.Scan(
		&id,
		&userID,
		&name,
		&description,
		&splitTypeStr,
		&daysPerWeek,
		&levelStr,
		&isPublic,
		&authorName,
		&likesCount,
		&installsCount,
		&daysJSON,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, program.ErrProgramNotFound
		}
		return nil, err
	}

	var rawDays []DayJSONItem
	_ = json.Unmarshal(daysJSON, &rawDays)

	var days []*program.ProgramDay
	for _, rd := range rawDays {
		var exercises []*program.ProgramExercise
		for _, re := range rd.Exercises {
			ex, _ := program.NewProgramExercise(
				re.ExerciseID,
				re.ExerciseName,
				re.OrderIndex,
				re.TargetSets,
				re.TargetRepsMin,
				re.TargetRepsMax,
			)
			if ex != nil {
				exercises = append(exercises, ex)
			}
		}
		d, _ := program.NewProgramDay(rd.DayNumber, rd.Name, rd.Notes, exercises)
		if d != nil {
			days = append(days, d)
		}
	}

	descStr := ""
	if description != nil {
		descStr = *description
	}
	authStr := ""
	if authorName != nil {
		authStr = *authorName
	}

	return program.Reconstitute(
		id,
		userID,
		name,
		descStr,
		program.SplitType(splitTypeStr),
		daysPerWeek,
		program.Level(levelStr),
		isPublic,
		authStr,
		likesCount,
		installsCount,
		days,
		createdAt,
		updatedAt,
	), nil
}

func scanUserProgram(row pgx.Row) (*program.UserProgram, error) {
	var (
		id              uuid.UUID
		userID          uuid.UUID
		programID       uuid.UUID
		customName      *string
		isActive        bool
		currentDayIndex int
		installedAt     time.Time
	)

	err := row.Scan(
		&id,
		&userID,
		&programID,
		&customName,
		&isActive,
		&currentDayIndex,
		&installedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, program.ErrUserProgramNotFound
		}
		return nil, err
	}

	nameStr := ""
	if customName != nil {
		nameStr = *customName
	}

	return program.ReconstituteUserProgram(
		id,
		userID,
		programID,
		nameStr,
		isActive,
		currentDayIndex,
		installedAt,
	), nil
}
