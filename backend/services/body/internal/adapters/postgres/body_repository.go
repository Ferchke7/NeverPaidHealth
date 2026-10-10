package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

type BodyRepository struct {
	pool *pgxpool.Pool
}

func NewBodyRepository(pool *pgxpool.Pool) *BodyRepository {
	return &BodyRepository{pool: pool}
}

func (r *BodyRepository) GetByDate(ctx context.Context, userID uuid.UUID, logDate string) (*body.BodyLog, error) {
	query := `
		SELECT id, user_id, log_date, weight_grams, body_fat_percentage, waist_cm, chest_cm, arms_cm, thighs_cm, calves_cm, neck_cm, calculated_bmi, created_at, updated_at
		FROM body_logs WHERE user_id = $1 AND log_date = $2
	`
	row := r.pool.QueryRow(ctx, query, userID, logDate)
	return scanBodyLog(row)
}

func (r *BodyRepository) ListRange(ctx context.Context, userID uuid.UUID, fromDate, toDate string) ([]*body.BodyLog, error) {
	query := `
		SELECT id, user_id, log_date, weight_grams, body_fat_percentage, waist_cm, chest_cm, arms_cm, thighs_cm, calves_cm, neck_cm, calculated_bmi, created_at, updated_at
		FROM body_logs WHERE user_id = $1 AND log_date >= $2 AND log_date <= $3 ORDER BY log_date ASC
	`
	rows, err := r.pool.Query(ctx, query, userID, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*body.BodyLog
	for rows.Next() {
		l, err := scanBodyLog(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, nil
}

func (r *BodyRepository) ListAll(ctx context.Context, userID uuid.UUID) ([]*body.BodyLog, error) {
	query := `
		SELECT id, user_id, log_date, weight_grams, body_fat_percentage, waist_cm, chest_cm, arms_cm, thighs_cm, calves_cm, neck_cm, calculated_bmi, created_at, updated_at
		FROM body_logs WHERE user_id = $1 ORDER BY log_date ASC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*body.BodyLog
	for rows.Next() {
		l, err := scanBodyLog(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, nil
}

func (r *BodyRepository) Save(ctx context.Context, l *body.BodyLog) error {
	var bf *float64
	if l.BodyFat() != nil {
		v := l.BodyFat().Value()
		bf = &v
	}

	cv := l.Circumferences().Values()

	query := `
		INSERT INTO body_logs (id, user_id, log_date, weight_grams, body_fat_percentage, waist_cm, chest_cm, arms_cm, thighs_cm, calves_cm, neck_cm, calculated_bmi, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (user_id, log_date) DO UPDATE SET
			weight_grams = EXCLUDED.weight_grams,
			body_fat_percentage = EXCLUDED.body_fat_percentage,
			waist_cm = EXCLUDED.waist_cm,
			chest_cm = EXCLUDED.chest_cm,
			arms_cm = EXCLUDED.arms_cm,
			thighs_cm = EXCLUDED.thighs_cm,
			calves_cm = EXCLUDED.calves_cm,
			neck_cm = EXCLUDED.neck_cm,
			calculated_bmi = EXCLUDED.calculated_bmi,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.pool.Exec(ctx, query,
		l.ID(),
		l.UserID(),
		l.LogDate(),
		l.Weight().Grams(),
		bf,
		cv.Waist,
		cv.Chest,
		cv.Arms,
		cv.Thighs,
		cv.Calves,
		cv.Neck,
		l.CalculatedBMI(),
		l.CreatedAt(),
		l.UpdatedAt(),
	)
	return err
}

func (r *BodyRepository) Delete(ctx context.Context, userID uuid.UUID, logDate string) error {
	query := `DELETE FROM body_logs WHERE user_id = $1 AND log_date = $2`
	_, err := r.pool.Exec(ctx, query, userID, logDate)
	return err
}

func scanBodyLog(row pgx.Row) (*body.BodyLog, error) {
	var (
		id          uuid.UUID
		userID      uuid.UUID
		logDate     string
		weightGrams int64
		bfVal       *float64
		waistVal    *float64
		chestVal    *float64
		armsVal     *float64
		thighsVal   *float64
		calvesVal   *float64
		neckVal     *float64
		bmiVal      *float64
		createdAt   time.Time
		updatedAt   time.Time
	)

	err := row.Scan(&id, &userID, &logDate, &weightGrams, &bfVal, &waistVal, &chestVal, &armsVal, &thighsVal, &calvesVal, &neckVal, &bmiVal, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, body.ErrBodyLogNotFound
		}
		return nil, err
	}

	weight, err := body.NewBodyWeightGrams(weightGrams)
	if err != nil {
		return nil, err
	}

	var bfVO *body.BodyFatPercentage
	if bfVal != nil {
		v, err := body.NewBodyFatPercentage(*bfVal)
		if err == nil {
			bfVO = &v
		}
	}

	circumferences, _ := body.NewCircumferenceMetrics(body.CircumferenceValues{
		Waist:  waistVal,
		Chest:  chestVal,
		Arms:   armsVal,
		Thighs: thighsVal,
		Calves: calvesVal,
		Neck:   neckVal,
	})

	return body.Reconstitute(id, userID, logDate, weight, bfVO, circumferences, bmiVal, createdAt, updatedAt), nil
}
