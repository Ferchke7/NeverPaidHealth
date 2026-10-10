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

type CircumferenceValues struct {
	Waist  *float64
	Chest  *float64
	Arms   *float64
	Thighs *float64
	Calves *float64
	Neck   *float64
}

func (c CircumferenceMetrics) Values() CircumferenceValues {
	var v CircumferenceValues
	if c.Waist != nil {
		val := c.Waist.Cm()
		v.Waist = &val
	}
	if c.Chest != nil {
		val := c.Chest.Cm()
		v.Chest = &val
	}
	if c.Arms != nil {
		val := c.Arms.Cm()
		v.Arms = &val
	}
	if c.Thighs != nil {
		val := c.Thighs.Cm()
		v.Thighs = &val
	}
	if c.Calves != nil {
		val := c.Calves.Cm()
		v.Calves = &val
	}
	if c.Neck != nil {
		val := c.Neck.Cm()
		v.Neck = &val
	}
	return v
}

func NewCircumferenceMetrics(v CircumferenceValues) (CircumferenceMetrics, error) {
	var m CircumferenceMetrics
	if v.Waist != nil {
		c, err := NewCircumferenceCm(*v.Waist)
		if err != nil {
			return m, err
		}
		m.Waist = &c
	}
	if v.Chest != nil {
		c, err := NewCircumferenceCm(*v.Chest)
		if err != nil {
			return m, err
		}
		m.Chest = &c
	}
	if v.Arms != nil {
		c, err := NewCircumferenceCm(*v.Arms)
		if err != nil {
			return m, err
		}
		m.Arms = &c
	}
	if v.Thighs != nil {
		c, err := NewCircumferenceCm(*v.Thighs)
		if err != nil {
			return m, err
		}
		m.Thighs = &c
	}
	if v.Calves != nil {
		c, err := NewCircumferenceCm(*v.Calves)
		if err != nil {
			return m, err
		}
		m.Calves = &c
	}
	if v.Neck != nil {
		c, err := NewCircumferenceCm(*v.Neck)
		if err != nil {
			return m, err
		}
		m.Neck = &c
	}
	return m, nil
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
