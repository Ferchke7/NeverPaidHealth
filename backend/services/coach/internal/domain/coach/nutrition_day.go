package coach

import (
	"errors"
	"time"
	_ "time/tzdata"
)

var ErrInvalidNutritionDay = errors.New("invalid nutrition date or timezone")

// NutritionDayBounds returns a half-open range for one local calendar day.
// AddDate preserves DST boundaries, where a day can be 23 or 25 hours long.
func NutritionDayBounds(date, timezone string, now time.Time) (time.Time, time.Time, error) {
	if timezone == "" {
		timezone = "UTC"
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return time.Time{}, time.Time{}, ErrInvalidNutritionDay
	}
	if date == "" {
		date = now.In(location).Format("2006-01-02")
	}
	start, err := time.ParseInLocation("2006-01-02", date, location)
	if err != nil || start.Format("2006-01-02") != date {
		return time.Time{}, time.Time{}, ErrInvalidNutritionDay
	}
	return start, start.AddDate(0, 0, 1), nil
}
