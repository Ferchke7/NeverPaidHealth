package memory

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/weeklyplan"
)

type FakeWeeklyPlanRepo struct {
	mu    sync.RWMutex
	items map[uuid.UUID][]*weeklyplan.PlanItem
}

func NewFakeWeeklyPlanRepo() *FakeWeeklyPlanRepo {
	return &FakeWeeklyPlanRepo{
		items: make(map[uuid.UUID][]*weeklyplan.PlanItem),
	}
}

func (r *FakeWeeklyPlanRepo) ListByUserID(_ context.Context, userID uuid.UUID) ([]*weeklyplan.PlanItem, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	src := r.items[userID]
	out := make([]*weeklyplan.PlanItem, 0, len(src))
	for _, it := range src {
		cp := *it
		out = append(out, &cp)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].DayOfWeek != out[j].DayOfWeek {
			return out[i].DayOfWeek < out[j].DayOfWeek
		}
		return out[i].OrderIndex < out[j].OrderIndex
	})
	return out, nil
}

func (r *FakeWeeklyPlanRepo) ReplaceAll(_ context.Context, userID uuid.UUID, items []*weeklyplan.PlanItem) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	out := make([]*weeklyplan.PlanItem, 0, len(items))
	for _, it := range items {
		cp := *it
		out = append(out, &cp)
	}
	r.items[userID] = out
	return nil
}

func (r *FakeWeeklyPlanRepo) ReplaceRoutineDays(
	_ context.Context,
	userID uuid.UUID,
	routineID uuid.UUID,
	title string,
	daysOfWeek []int,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	want := make(map[int]bool, len(daysOfWeek))
	for _, d := range daysOfWeek {
		want[d] = true
	}

	kept := make([]*weeklyplan.PlanItem, 0)
	presentDays := make(map[int]bool)
	for _, it := range r.items[userID] {
		if it.ItemType == weeklyplan.ItemTypeRoutine && it.RoutineID != nil && *it.RoutineID == routineID {
			if want[it.DayOfWeek] && !presentDays[it.DayOfWeek] {
				presentDays[it.DayOfWeek] = true
				cp := *it
				cp.Title = title
				cp.UpdatedAt = time.Now().UTC()
				kept = append(kept, &cp)
			}
			continue
		}
		cp := *it
		kept = append(kept, &cp)
	}

	now := time.Now().UTC()
	for _, d := range daysOfWeek {
		if presentDays[d] {
			continue
		}
		maxIdx := -1
		for _, it := range kept {
			if it.DayOfWeek == d && it.OrderIndex > maxIdx {
				maxIdx = it.OrderIndex
			}
		}
		rid := routineID
		kept = append(kept, &weeklyplan.PlanItem{
			ID:         uuid.New(),
			UserID:     userID,
			DayOfWeek:  d,
			OrderIndex: maxIdx + 1,
			ItemType:   weeklyplan.ItemTypeRoutine,
			RoutineID:  &rid,
			Title:      title,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
	}

	r.items[userID] = kept
	return nil
}

func (r *FakeWeeklyPlanRepo) SetCompletedWeek(
	_ context.Context,
	userID uuid.UUID,
	itemID uuid.UUID,
	completedWeekStart string,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, it := range r.items[userID] {
		if it.ID == itemID {
			it.CompletedWeekStart = completedWeekStart
			it.UpdatedAt = time.Now().UTC()
		}
	}
	return nil
}
