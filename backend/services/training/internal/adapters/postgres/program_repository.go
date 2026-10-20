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
	repo := &ProgramRepository{pool: pool}
	if pool != nil {
		repo.InitSchema(context.Background())
	}
	return repo
}

func (r *ProgramRepository) InitSchema(ctx context.Context) {
	if r.pool == nil {
		return
	}
	schema := `
		UPDATE programs SET likes_count = 0, installs_count = 0 WHERE user_id = '00000000-0000-0000-0000-000000000000';

		CREATE TABLE IF NOT EXISTS program_reviews (
			id UUID PRIMARY KEY,
			program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
			user_id UUID NOT NULL,
			author_name VARCHAR(100) NOT NULL DEFAULT 'Атлет',
			rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
			comment TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT uq_program_user_review UNIQUE (program_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_program_reviews_prog ON program_reviews(program_id, created_at DESC);

		CREATE TABLE IF NOT EXISTS feedback_reports (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			author_name VARCHAR(100) NOT NULL DEFAULT 'Атлет',
			category VARCHAR(30) NOT NULL DEFAULT 'bug',
			title VARCHAR(200) NOT NULL,
			message TEXT NOT NULL,
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			upvotes INT NOT NULL DEFAULT 0,
			upvoters UUID[] NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_feedback_reports_cat ON feedback_reports(category);

		CREATE TABLE IF NOT EXISTS coach_messages (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			role VARCHAR(20) NOT NULL,
			content TEXT NOT NULL,
			suggested_workout JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_coach_messages_user_created ON coach_messages(user_id, created_at ASC);

		CREATE TABLE IF NOT EXISTS program_comments (
			id UUID PRIMARY KEY,
			program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
			user_id UUID NOT NULL,
			author_name VARCHAR(100) NOT NULL DEFAULT 'Атлет',
			parent_id UUID NULL REFERENCES program_comments(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			upvotes INT NOT NULL DEFAULT 0,
			upvoters UUID[] NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ NULL
		);
		CREATE INDEX IF NOT EXISTS idx_program_comments_prog_created ON program_comments(program_id, created_at ASC);
		CREATE INDEX IF NOT EXISTS idx_program_comments_parent ON program_comments(parent_id);

		CREATE TABLE IF NOT EXISTS program_likes (
			program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
			user_id UUID NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (program_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_program_likes_prog ON program_likes(program_id);
		CREATE INDEX IF NOT EXISTS idx_program_likes_user ON program_likes(user_id);
	`
	_, _ = r.pool.Exec(ctx, schema)
}

const programSelectCols = `
	p.id, p.user_id, p.name, p.description, p.split_type, p.days_per_week, p.level, p.is_public, p.author_name,
	COALESCE((SELECT COUNT(*) FROM program_likes pl WHERE pl.program_id = p.id), 0) AS likes_count,
	COALESCE((SELECT COUNT(DISTINCT up.user_id) FROM user_programs up WHERE up.program_id = p.id), 0) AS installs_count,
	p.days, p.created_at, p.updated_at,
	COALESCE((SELECT ROUND(AVG(pr.rating)::numeric, 1) FROM program_reviews pr WHERE pr.program_id = p.id), 0.0) AS rating_avg,
	COALESCE((SELECT COUNT(*) FROM program_reviews pr WHERE pr.program_id = p.id), 0) AS reviews_count,
	COALESCE((SELECT COUNT(*) FROM program_comments pc WHERE pc.program_id = p.id AND pc.deleted_at IS NULL), 0) AS comments_count
`

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
	query := fmt.Sprintf(`
		SELECT %s
		FROM programs p WHERE p.id = $1
	`, programSelectCols)
	row := r.pool.QueryRow(ctx, query, id)
	return scanProgram(row)
}

func (r *ProgramRepository) ListLibrary(ctx context.Context, splitType string, search string) ([]*program.Program, error) {
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, "p.user_id = '00000000-0000-0000-0000-000000000000'")

	if splitType != "" && splitType != "all" {
		conditions = append(conditions, fmt.Sprintf("p.split_type = $%d", argIdx))
		args = append(args, splitType)
		argIdx++
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(p.name ILIKE $%d OR p.description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM programs p
		WHERE %s
		ORDER BY p.created_at ASC
	`, programSelectCols, strings.Join(conditions, " AND "))

	return r.queryPrograms(ctx, query, args...)
}

func (r *ProgramRepository) ListCommunity(ctx context.Context, splitType string, search string, limit int, offset int) ([]*program.Program, error) {
	if limit <= 0 {
		limit = 50
	}
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, "p.is_public = true")

	if splitType != "" && splitType != "all" {
		conditions = append(conditions, fmt.Sprintf("p.split_type = $%d", argIdx))
		args = append(args, splitType)
		argIdx++
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(p.name ILIKE $%d OR p.description ILIKE $%d OR p.author_name ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM programs p
		WHERE %s
		ORDER BY installs_count DESC, rating_avg DESC, p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, programSelectCols, strings.Join(conditions, " AND "), argIdx, argIdx+1)

	args = append(args, limit, offset)
	return r.queryPrograms(ctx, query, args...)
}

func (r *ProgramRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*program.Program, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM programs p
		WHERE p.user_id = $1
		ORDER BY p.created_at DESC
	`, programSelectCols)
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
		WHERE programs.user_id = EXCLUDED.user_id OR EXCLUDED.user_id = '00000000-0000-0000-0000-000000000000'
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
	query := `DELETE FROM programs WHERE id = $1 AND user_id != '00000000-0000-0000-0000-000000000000'`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *ProgramRepository) queryPrograms(ctx context.Context, query string, args ...any) ([]*program.Program, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*program.Program, 0)
	for rows.Next() {
		p, err := scanProgram(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
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

	list := make([]*program.UserProgram, 0)
	for rows.Next() {
		up, err := scanUserProgram(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, up)
	}
	if err := rows.Err(); err != nil {
		return nil, err
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
		ratingAvg     float64
		reviewsCount  int
		commentsCount int
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
		&ratingAvg,
		&reviewsCount,
		&commentsCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, program.ErrProgramNotFound
		}
		return nil, err
	}

	var rawDays []DayJSONItem
	if len(daysJSON) > 0 {
		if err := json.Unmarshal(daysJSON, &rawDays); err != nil {
			return nil, fmt.Errorf("failed to unmarshal program days: %w", err)
		}
	}

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

	prog := program.Reconstitute(
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
	)
	prog.SetReviewsStats(ratingAvg, reviewsCount)
	prog.SetCommentsCount(commentsCount)
	return prog, nil
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
