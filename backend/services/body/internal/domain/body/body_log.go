package body

import (
	"time"

	"github.com/google/uuid"
)

type CircumferenceMetrics struct {
	Waist  *Circumference
	Chest  *Circumference
	Arms   *Circumference
	Thighs *Circumference
	Calves *Circumference
	Neck   *Circumference
}

type BodyLog struct {
	id             uuid.UUID
	userID         uuid.UUID
	logDate        string // YYYY-MM-DD
	weight         BodyWeight
	bodyFat        *BodyFatPercentage
	circumferences CircumferenceMetrics
	calculatedBMI  *float64
	createdAt      time.Time
	updatedAt      time.Time
}

func NewBodyLog(
	userID uuid.UUID,
	logDate string,
	weight BodyWeight,
	bodyFat *BodyFatPercentage,
	circumferences CircumferenceMetrics,
	heightCm *float64,
	now time.Time,
) (*BodyLog, error) {
	var bmi *float64
	if heightCm != nil {
		calculated, err := CalculateBMI(weight, *heightCm)
		if err != nil {
			return nil, err
		}
		bmi = calculated
	}

	return &BodyLog{
		id:             uuid.New(),
		userID:         userID,
		logDate:        logDate,
		weight:         weight,
		bodyFat:        bodyFat,
		circumferences: circumferences,
		calculatedBMI:  bmi,
		createdAt:      now,
		updatedAt:      now,
	}, nil
}

func Reconstitute(
	id uuid.UUID,
	userID uuid.UUID,
	logDate string,
	weight BodyWeight,
	bodyFat *BodyFatPercentage,
	circumferences CircumferenceMetrics,
	calculatedBMI *float64,
	createdAt, updatedAt time.Time,
) *BodyLog {
	return &BodyLog{
		id:             id,
		userID:         userID,
		logDate:        logDate,
		weight:         weight,
		bodyFat:        bodyFat,
		circumferences: circumferences,
		calculatedBMI:  calculatedBMI,
		createdAt:      createdAt,
		updatedAt:      updatedAt,
	}
}

func (b *BodyLog) ID() uuid.UUID { return b.id }
func (b *BodyLog) UserID() uuid.UUID { return b.userID }
func (b *BodyLog) LogDate() string { return b.logDate }
func (b *BodyLog) Weight() BodyWeight { return b.weight }
func (b *BodyLog) BodyFat() *BodyFatPercentage { return b.bodyFat }
func (b *BodyLog) Circumferences() CircumferenceMetrics { return b.circumferences }
func (b *BodyLog) CalculatedBMI() *float64 { return b.calculatedBMI }
func (b *BodyLog) CreatedAt() time.Time { return b.createdAt }
func (b *BodyLog) UpdatedAt() time.Time { return b.updatedAt }

func (b *BodyLog) Update(weight BodyWeight, bodyFat *BodyFatPercentage, circumferences CircumferenceMetrics, heightCm *float64, now time.Time) error {
	var bmi *float64
	if heightCm != nil {
		calculated, err := CalculateBMI(weight, *heightCm)
		if err != nil {
			return err
		}
		bmi = calculated
	}

	b.weight = weight
	b.bodyFat = bodyFat
	b.circumferences = circumferences
	b.calculatedBMI = bmi
	b.updatedAt = now
	return nil
}
