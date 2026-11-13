package coach

import (
	"errors"
	"testing"
	"time"
)

func TestNutritionDayUsesLocalMidnight(t *testing.T) {
	now := time.Date(2026, 11, 13, 22, 30, 0, 0, time.UTC)
	start, end, err := NutritionDayBounds("", "Europe/Moscow", now)
	if err != nil || start.Format("2006-01-02") != "2026-11-14" || start.UTC().Hour() != 21 || end.Sub(start) != 24*time.Hour {
		t.Fatalf("unexpected local day: %v %v %v", start, end, err)
	}
}

func TestNutritionDayFollowsDaylightSaving(t *testing.T) {
	start, end, err := NutritionDayBounds("2026-03-08", "America/New_York", time.Time{})
	if err != nil || end.Sub(start) != 23*time.Hour {
		t.Fatalf("spring day: %v %v %v", start, end, err)
	}
	start, end, err = NutritionDayBounds("2026-11-01", "America/New_York", time.Time{})
	if err != nil || end.Sub(start) != 25*time.Hour {
		t.Fatalf("autumn day: %v %v %v", start, end, err)
	}
}

func TestNutritionDayRejectsInvalidInput(t *testing.T) {
	for _, input := range [][2]string{{"2026-02-30", "UTC"}, {"2026-1-1", "UTC"}, {"2026-11-13", "Invalid/Zone"}} {
		_, _, err := NutritionDayBounds(input[0], input[1], time.Time{})
		if !errors.Is(err, ErrInvalidNutritionDay) {
			t.Fatalf("accepted %v", input)
		}
	}
}
