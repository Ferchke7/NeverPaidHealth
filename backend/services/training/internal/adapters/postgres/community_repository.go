package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProgramReview struct {
	ID         uuid.UUID `json:"id"`
	ProgramID  uuid.UUID `json:"program_id"`
	UserID     uuid.UUID `json:"user_id"`
	AuthorName string    `json:"author_name"`
	Rating     int       `json:"rating"`
	Comment    string    `json:"comment"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type FeedbackReport struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	AuthorName string    `json:"author_name"`
	Category   string    `json:"category"` // 'bug', 'feature', 'ux', 'other'
	Title      string    `json:"title"`
	Message    string    `json:"message"`
	Status     string    `json:"status"` // 'open', 'planned', 'in_progress', 'resolved'
	Upvotes    int       `json:"upvotes"`
	HasUpvoted bool      `json:"has_upvoted"`
	CreatedAt  time.Time `json:"created_at"`
}

type AthleteSummary struct {
	Name         string    `json:"name"`
	WorkoutsDone int       `json:"workouts_done"`
	LastActive   time.Time `json:"last_active"`
}

type PlatformStats struct {
	TotalUsers       int              `json:"total_users"`
	TotalWorkouts    int              `json:"total_workouts"`
	TotalVolumeKg    float64          `json:"total_volume_kg"`
	TotalPrograms    int              `json:"total_programs"`
	TotalReviews     int              `json:"total_reviews"`
	ActiveAthletes7d int              `json:"active_athletes_7d"`
	RecentAthletes   []AthleteSummary `json:"recent_athletes"`
}

type CommunityRepository struct {
	pool *pgxpool.Pool
}

func NewCommunityRepository(pool *pgxpool.Pool) *CommunityRepository {
	return &CommunityRepository{pool: pool}
}

// -------------------------------------------------------------
// Program Reviews
// -------------------------------------------------------------

func (r *CommunityRepository) ListProgramReviews(ctx context.Context, programID uuid.UUID) ([]ProgramReview, error) {
	if r.pool == nil {
		return make([]ProgramReview, 0), nil
	}

	query := `
		SELECT id, program_id, user_id, author_name, rating, comment, created_at, updated_at
		FROM program_reviews
		WHERE program_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, programID)
	if err != nil {
		return nil, fmt.Errorf("failed to query reviews: %w", err)
	}
	defer rows.Close()

	list := make([]ProgramReview, 0)
	for rows.Next() {
		var rev ProgramReview
		if err := rows.Scan(
			&rev.ID,
			&rev.ProgramID,
			&rev.UserID,
			&rev.AuthorName,
			&rev.Rating,
			&rev.Comment,
			&rev.CreatedAt,
			&rev.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, rev)
	}
	return list, nil
}

func (r *CommunityRepository) UpsertProgramReview(ctx context.Context, rev ProgramReview) (*ProgramReview, error) {
	if r.pool == nil {
		return &rev, nil
	}

	if rev.Rating < 1 {
		rev.Rating = 1
	}
	if rev.Rating > 5 {
		rev.Rating = 5
	}
	if rev.ID == uuid.Nil {
		rev.ID = uuid.New()
	}
	now := time.Now().UTC()
	rev.CreatedAt = now
	rev.UpdatedAt = now

	query := `
		INSERT INTO program_reviews (id, program_id, user_id, author_name, rating, comment, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (program_id, user_id) DO UPDATE SET
			rating = EXCLUDED.rating,
			comment = EXCLUDED.comment,
			author_name = EXCLUDED.author_name,
			updated_at = EXCLUDED.updated_at
		RETURNING id, created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query,
		rev.ID,
		rev.ProgramID,
		rev.UserID,
		rev.AuthorName,
		rev.Rating,
		rev.Comment,
		rev.CreatedAt,
		rev.UpdatedAt,
	).Scan(&rev.ID, &rev.CreatedAt, &rev.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to save review: %w", err)
	}

	return &rev, nil
}

func (r *CommunityRepository) DeleteProgramReview(ctx context.Context, programID, reviewID, userID uuid.UUID) error {
	if r.pool == nil {
		return nil
	}
	query := `DELETE FROM program_reviews WHERE id = $1 AND program_id = $2 AND user_id = $3`
	tag, err := r.pool.Exec(ctx, query, reviewID, programID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("review not found or permission denied")
	}
	return nil
}

// -------------------------------------------------------------
// Feedback & Bug Reports
// -------------------------------------------------------------

func (r *CommunityRepository) ListFeedback(ctx context.Context, currentUserID uuid.UUID) ([]FeedbackReport, error) {
	if r.pool == nil {
		return make([]FeedbackReport, 0), nil
	}

	query := `
		SELECT id, user_id, author_name, category, title, message, status, upvotes,
		       $1 = ANY(upvoters) AS has_upvoted, created_at
		FROM feedback_reports
		ORDER BY upvotes DESC, created_at DESC
		LIMIT 100
	`
	rows, err := r.pool.Query(ctx, query, currentUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to query feedback: %w", err)
	}
	defer rows.Close()

	list := make([]FeedbackReport, 0)
	for rows.Next() {
		var fb FeedbackReport
		if err := rows.Scan(
			&fb.ID,
			&fb.UserID,
			&fb.AuthorName,
			&fb.Category,
			&fb.Title,
			&fb.Message,
			&fb.Status,
			&fb.Upvotes,
			&fb.HasUpvoted,
			&fb.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, fb)
	}
	return list, nil
}

func (r *CommunityRepository) CreateFeedback(ctx context.Context, fb FeedbackReport) (*FeedbackReport, error) {
	if r.pool == nil {
		return &fb, nil
	}

	if fb.ID == uuid.Nil {
		fb.ID = uuid.New()
	}
	if fb.Category == "" {
		fb.Category = "bug"
	}
	if fb.Status == "" {
		fb.Status = "open"
	}
	now := time.Now().UTC()
	fb.CreatedAt = now

	query := `
		INSERT INTO feedback_reports (id, user_id, author_name, category, title, message, status, upvotes, upvoters, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 0, '{}', $8, $8)
	`
	_, err := r.pool.Exec(ctx, query,
		fb.ID,
		fb.UserID,
		fb.AuthorName,
		fb.Category,
		fb.Title,
		fb.Message,
		fb.Status,
		fb.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create feedback: %w", err)
	}
	return &fb, nil
}

func (r *CommunityRepository) ToggleFeedbackUpvote(ctx context.Context, feedbackID, userID uuid.UUID) (bool, int, error) {
	if r.pool == nil {
		return false, 0, nil
	}

	// Check if already upvoted
	var (
		hasUpvoted bool
		upvotes    int
	)
	checkQuery := `SELECT $2 = ANY(upvoters), upvotes FROM feedback_reports WHERE id = $1`
	err := r.pool.QueryRow(ctx, checkQuery, feedbackID, userID).Scan(&hasUpvoted, &upvotes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, 0, errors.New("feedback not found")
		}
		return false, 0, err
	}

	var updateQuery string
	if hasUpvoted {
		// Remove upvote
		updateQuery = `
			UPDATE feedback_reports
			SET upvotes = GREATEST(upvotes - 1, 0),
			    upvoters = array_remove(upvoters, $2),
			    updated_at = NOW()
			WHERE id = $1
			RETURNING upvotes
		`
		err = r.pool.QueryRow(ctx, updateQuery, feedbackID, userID).Scan(&upvotes)
		return false, upvotes, err
	} else {
		// Add upvote
		updateQuery = `
			UPDATE feedback_reports
			SET upvotes = upvotes + 1,
			    upvoters = array_append(upvoters, $2),
			    updated_at = NOW()
			WHERE id = $1
			RETURNING upvotes
		`
		err = r.pool.QueryRow(ctx, updateQuery, feedbackID, userID).Scan(&upvotes)
		return true, upvotes, err
	}
}

func (r *CommunityRepository) DeleteFeedback(ctx context.Context, feedbackID, userID uuid.UUID) error {
	if r.pool == nil {
		return nil
	}
	query := `DELETE FROM feedback_reports WHERE id = $1 AND user_id = $2`
	tag, err := r.pool.Exec(ctx, query, feedbackID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("feedback not found or permission denied")
	}
	return nil
}

// -------------------------------------------------------------
// Real Platform Statistics
// -------------------------------------------------------------

func (r *CommunityRepository) GetPlatformStats(ctx context.Context) (*PlatformStats, error) {
	stats := &PlatformStats{
		RecentAthletes: make([]AthleteSummary, 0),
	}
	if r.pool == nil {
		return stats, nil
	}

	// 1. Total finished workouts and total volume
	wQuery := `
		SELECT
			COUNT(*),
			COALESCE(SUM(total_volume_kg), 0)
		FROM workouts
		WHERE status = 'finished'
	`
	_ = r.pool.QueryRow(ctx, wQuery).Scan(&stats.TotalWorkouts, &stats.TotalVolumeKg)

	// 2. Total unique users & active athletes last 7 days
	uQuery := `
		SELECT
			COUNT(DISTINCT user_id)
		FROM (
			SELECT user_id FROM workouts
			UNION
			SELECT user_id FROM user_programs
			UNION
			SELECT user_id FROM feedback_reports
			UNION
			SELECT user_id FROM program_reviews
		) active_pool
	`
	_ = r.pool.QueryRow(ctx, uQuery).Scan(&stats.TotalUsers)
	if stats.TotalUsers == 0 {
		stats.TotalUsers = 1 // at least the requesting user
	}

	a7Query := `
		SELECT COUNT(DISTINCT user_id)
		FROM workouts
		WHERE started_at >= NOW() - INTERVAL '7 days'
	`
	_ = r.pool.QueryRow(ctx, a7Query).Scan(&stats.ActiveAthletes7d)

	// 3. Total programs and total reviews
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM programs`).Scan(&stats.TotalPrograms)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM program_reviews`).Scan(&stats.TotalReviews)

	// 4. Recent Active Athletes summary
	recentQuery := `
		SELECT
			COALESCE(NULLIF(pr.author_name, ''), NULLIF(fb.author_name, ''), 'Атлет ' || SUBSTRING(w.user_id::text, 1, 6)) AS athlete_name,
			COUNT(w.id) as workouts_done,
			MAX(w.started_at) as last_active
		FROM workouts w
		LEFT JOIN LATERAL (SELECT author_name FROM program_reviews WHERE user_id = w.user_id ORDER BY created_at DESC LIMIT 1) pr ON true
		LEFT JOIN LATERAL (SELECT author_name FROM feedback_reports WHERE user_id = w.user_id ORDER BY created_at DESC LIMIT 1) fb ON true
		WHERE w.status = 'finished'
		GROUP BY w.user_id, pr.author_name, fb.author_name
		ORDER BY last_active DESC
		LIMIT 10
	`
	rows, err := r.pool.Query(ctx, recentQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var a AthleteSummary
			if err := rows.Scan(&a.Name, &a.WorkoutsDone, &a.LastActive); err == nil {
				stats.RecentAthletes = append(stats.RecentAthletes, a)
			}
		}
	}

	return stats, nil
}
