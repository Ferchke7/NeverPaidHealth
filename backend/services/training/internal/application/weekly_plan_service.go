package application

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/weeklyplan"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

var ErrInvalidDayOfWeek = errors.New("day_of_week must be between 1 and 7")

type WeeklyPlanItemInput struct {
	ID               *uuid.UUID
	DayOfWeek        int
	OrderIndex       int
	ItemType         string
	RoutineID        *uuid.UUID
	ProgramID        *uuid.UUID
	ProgramDayNumber *int
	Title            string
	Notes            string
}

type WeeklyPlanSnapshot struct {
	WeekStart string
	Items     []*weeklyplan.PlanItem
}

type WeeklyPlanService struct {
	planRepo    WeeklyPlanRepo
	routineRepo RoutineRepo
	programRepo ProgramRepo
	workoutRepo WorkoutRepo
	clock       Clock
}

func NewWeeklyPlanService(
	planRepo WeeklyPlanRepo,
	routineRepo RoutineRepo,
	programRepo ProgramRepo,
	workoutRepo WorkoutRepo,
	clock Clock,
) *WeeklyPlanService {
	if clock == nil {
		clock = RealClock{}
	}
	return &WeeklyPlanService{
		planRepo:    planRepo,
		routineRepo: routineRepo,
		programRepo: programRepo,
		workoutRepo: workoutRepo,
		clock:       clock,
	}
}

func normalizeBaseRoutineTitle(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	suffixes := []string{"(custom)", "(своя)", "(shaxsiy)"}
	changed := true
	for changed {
		changed = false
		for _, sf := range suffixes {
			if strings.HasSuffix(s, sf) {
				s = strings.TrimSpace(strings.TrimSuffix(s, sf))
				changed = true
			}
		}
	}
	return s
}

func (s *WeeklyPlanService) GetWeeklyPlan(ctx context.Context, userID uuid.UUID) (*WeeklyPlanSnapshot, error) {
	now := s.clock.Now()
	weekStart := weeklyplan.MondayKey(now)
	weekStartTime := weeklyplan.MondayStart(now)

	stored, err := s.planRepo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	routineMap := make(map[uuid.UUID]*routine.Routine)
	personalByBase := make(map[string]*routine.Routine)
	if s.routineRepo != nil {
		if routines, rErr := s.routineRepo.ListByUserID(ctx, userID); rErr == nil {
			for _, rt := range routines {
				routineMap[rt.ID()] = rt
				if rt.UserID() != uuid.Nil {
					base := normalizeBaseRoutineTitle(rt.Name())
					if base != "" {
						personalByBase[base] = rt
					}
				}
			}
		}
	}

	programMap := make(map[uuid.UUID]*program.Program)
	if s.programRepo != nil {
		for _, item := range stored {
			if item.ProgramID != nil && *item.ProgramID != uuid.Nil {
				if _, seen := programMap[*item.ProgramID]; !seen {
					if p, pErr := s.programRepo.GetByID(ctx, *item.ProgramID); pErr == nil && p != nil {
						programMap[*item.ProgramID] = p
					}
				}
			}
		}
	}

	var finishedThisWeek []*workout.Workout
	if s.workoutRepo != nil {
		if recent, wErr := s.workoutRepo.List(ctx, userID, 40, 0); wErr == nil {
			for _, w := range recent {
				if string(w.Status()) != "finished" {
					continue
				}
				ts := w.StartedAt()
				if w.FinishedAt() != nil {
					ts = *w.FinishedAt()
				}
				if !ts.Before(weekStartTime) {
					finishedThisWeek = append(finishedThisWeek, w)
				}
			}
		}
	}

	usedWorkouts := make(map[uuid.UUID]bool)
	enriched := make([]*weeklyplan.PlanItem, 0, len(stored))

	sort.SliceStable(stored, func(i, j int) bool {
		if stored[i].DayOfWeek != stored[j].DayOfWeek {
			return stored[i].DayOfWeek < stored[j].DayOfWeek
		}
		if stored[i].OrderIndex != stored[j].OrderIndex {
			return stored[i].OrderIndex < stored[j].OrderIndex
		}
		return stored[i].CreatedAt.Before(stored[j].CreatedAt)
	})

	perDayCounter := make(map[int]int)
	for _, raw := range stored {
		if raw.DayOfWeek < 1 || raw.DayOfWeek > 7 {
			continue
		}
		copyItem := *raw
		if copyItem.ItemType != weeklyplan.ItemTypeProgramDay {
			copyItem.ItemType = weeklyplan.ItemTypeRoutine
		}

		if copyItem.ItemType == weeklyplan.ItemTypeRoutine && copyItem.RoutineID != nil {
			rt := routineMap[*copyItem.RoutineID]
			if rt == nil && s.routineRepo != nil {
				rt, _ = s.routineRepo.GetByID(ctx, *copyItem.RoutineID)
			}
			if rt == nil {
				// Underlying routine was deleted; skip orphan gracefully
				continue
			}
			if rt.UserID() == uuid.Nil {
				if personal, ok := personalByBase[normalizeBaseRoutineTitle(rt.Name())]; ok {
					rt = personal
					pid := personal.ID()
					copyItem.RoutineID = &pid
				}
			}
			copyItem.Title = rt.Name()
			if copyItem.Notes == "" {
				copyItem.Subtitle = rt.Notes()
			} else {
				copyItem.Subtitle = copyItem.Notes
			}
			exs := make([]weeklyplan.PlanExercise, 0, len(rt.Exercises()))
			for _, ex := range rt.Exercises() {
				exs = append(exs, weeklyplan.PlanExercise{
					ExerciseID:    ex.ExerciseID(),
					ExerciseName:  ex.ExerciseName(),
					OrderIndex:    ex.OrderIndex(),
					TargetSets:    ex.TargetSets(),
					TargetRepsMin: ex.TargetRepsMin(),
					TargetRepsMax: ex.TargetRepsMax(),
				})
			}
			copyItem.Exercises = exs
		} else if copyItem.ItemType == weeklyplan.ItemTypeProgramDay && copyItem.ProgramID != nil {
			prog := programMap[*copyItem.ProgramID]
			if prog == nil {
				continue
			}
			dayNum := 1
			if copyItem.ProgramDayNumber != nil && *copyItem.ProgramDayNumber > 0 {
				dayNum = *copyItem.ProgramDayNumber
			}
			var matchedDay *program.ProgramDay
			for _, d := range prog.Days() {
				if d.DayNumber() == dayNum {
					matchedDay = d
					break
				}
			}
			if matchedDay == nil && len(prog.Days()) > 0 {
				matchedDay = prog.Days()[0]
				dn := matchedDay.DayNumber()
				copyItem.ProgramDayNumber = &dn
			}
			if matchedDay == nil {
				continue
			}
			copyItem.Title = matchedDay.Name()
			copyItem.Subtitle = prog.Name()
			exs := make([]weeklyplan.PlanExercise, 0, len(matchedDay.Exercises()))
			for _, ex := range matchedDay.Exercises() {
				exs = append(exs, weeklyplan.PlanExercise{
					ExerciseID:    ex.ExerciseID(),
					ExerciseName:  ex.ExerciseName(),
					OrderIndex:    ex.OrderIndex(),
					TargetSets:    ex.TargetSets(),
					TargetRepsMin: ex.TargetRepsMin(),
					TargetRepsMax: ex.TargetRepsMax(),
				})
			}
			copyItem.Exercises = exs
		}

		if strings.TrimSpace(copyItem.Title) == "" {
			copyItem.Title = "Тренировка"
		}

		copyItem.OrderIndex = perDayCounter[copyItem.DayOfWeek]
		perDayCounter[copyItem.DayOfWeek]++

		// Compute weekly completion status
		switch copyItem.CompletedWeekStart {
		case "skip_" + weekStart:
			copyItem.IsCompletedThisWeek = false
		case weekStart:
			copyItem.IsCompletedThisWeek = true
		default:
			copyItem.IsCompletedThisWeek = matchWorkoutThisWeek(&copyItem, finishedThisWeek, usedWorkouts)
		}

		enriched = append(enriched, &copyItem)
	}

	return &WeeklyPlanSnapshot{
		WeekStart: weekStart,
		Items:     enriched,
	}, nil
}

func matchWorkoutThisWeek(item *weeklyplan.PlanItem, finished []*workout.Workout, used map[uuid.UUID]bool) bool {
	normTitle := normalizeBaseRoutineTitle(item.Title)
	normSub := strings.ToLower(strings.TrimSpace(item.Subtitle))

	for _, w := range finished {
		if used[w.ID()] {
			continue
		}
		if item.RoutineID != nil && w.RoutineID() != nil && *w.RoutineID() == *item.RoutineID {
			used[w.ID()] = true
			return true
		}
		wName := normalizeBaseRoutineTitle(w.Name())
		if normTitle != "" && wName == normTitle {
			used[w.ID()] = true
			return true
		}
		if item.ItemType == weeklyplan.ItemTypeProgramDay && normSub != "" && normTitle != "" {
			rawW := strings.ToLower(strings.TrimSpace(w.Name()))
			if strings.Contains(rawW, normSub) && strings.Contains(rawW, normTitle) {
				used[w.ID()] = true
				return true
			}
		}
	}
	return false
}

func (s *WeeklyPlanService) SaveWeeklyPlan(
	ctx context.Context,
	userID uuid.UUID,
	inputs []WeeklyPlanItemInput,
) (*WeeklyPlanSnapshot, error) {
	now := s.clock.Now()
	existing, err := s.planRepo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	existingByID := make(map[uuid.UUID]*weeklyplan.PlanItem, len(existing))
	for _, ex := range existing {
		existingByID[ex.ID] = ex
	}

	perDayIdx := make(map[int]int)
	toSave := make([]*weeklyplan.PlanItem, 0, len(inputs))

	for _, in := range inputs {
		if in.DayOfWeek < 1 || in.DayOfWeek > 7 {
			return nil, ErrInvalidDayOfWeek
		}
		id := uuid.New()
		completedWeek := ""
		createdAt := now
		if in.ID != nil && *in.ID != uuid.Nil {
			id = *in.ID
			if prev, ok := existingByID[id]; ok {
				completedWeek = prev.CompletedWeekStart
				createdAt = prev.CreatedAt
			}
		}

		itemType := strings.ToLower(strings.TrimSpace(in.ItemType))
		if itemType != weeklyplan.ItemTypeProgramDay {
			itemType = weeklyplan.ItemTypeRoutine
		}

		var routineID *uuid.UUID
		if in.RoutineID != nil && *in.RoutineID != uuid.Nil {
			rid := *in.RoutineID
			routineID = &rid
		}

		var programID *uuid.UUID
		if in.ProgramID != nil && *in.ProgramID != uuid.Nil {
			pid := *in.ProgramID
			programID = &pid
		}

		var progDayNum *int
		if in.ProgramDayNumber != nil && *in.ProgramDayNumber > 0 {
			dn := *in.ProgramDayNumber
			progDayNum = &dn
		}

		idx := perDayIdx[in.DayOfWeek]
		perDayIdx[in.DayOfWeek]++

		toSave = append(toSave, &weeklyplan.PlanItem{
			ID:                 id,
			UserID:             userID,
			DayOfWeek:          in.DayOfWeek,
			OrderIndex:         idx,
			ItemType:           itemType,
			RoutineID:          routineID,
			ProgramID:          programID,
			ProgramDayNumber:   progDayNum,
			Title:              strings.TrimSpace(in.Title),
			Notes:              strings.TrimSpace(in.Notes),
			CompletedWeekStart: completedWeek,
			CreatedAt:          createdAt,
			UpdatedAt:          now,
		})
	}

	if err := s.planRepo.ReplaceAll(ctx, userID, toSave); err != nil {
		return nil, err
	}
	return s.GetWeeklyPlan(ctx, userID)
}

func (s *WeeklyPlanService) SetRoutineWeekdays(
	ctx context.Context,
	userID uuid.UUID,
	routineID uuid.UUID,
	daysOfWeek []int,
) (*WeeklyPlanSnapshot, error) {
	seen := make(map[int]bool)
	cleanDays := make([]int, 0, len(daysOfWeek))
	for _, d := range daysOfWeek {
		if d < 1 || d > 7 {
			return nil, ErrInvalidDayOfWeek
		}
		if !seen[d] {
			seen[d] = true
			cleanDays = append(cleanDays, d)
		}
	}
	sort.Ints(cleanDays)

	title := "Тренировка"
	if s.routineRepo != nil {
		if rt, err := s.routineRepo.GetByID(ctx, routineID); err == nil && rt != nil {
			title = rt.Name()
		}
	}

	if err := s.planRepo.ReplaceRoutineDays(ctx, userID, routineID, title, cleanDays); err != nil {
		return nil, err
	}
	return s.GetWeeklyPlan(ctx, userID)
}

func (s *WeeklyPlanService) ToggleItemCompleted(
	ctx context.Context,
	userID uuid.UUID,
	itemID uuid.UUID,
	completed bool,
) (*WeeklyPlanSnapshot, error) {
	weekStart := weeklyplan.MondayKey(s.clock.Now())
	marker := "skip_" + weekStart
	if completed {
		marker = weekStart
	}
	if err := s.planRepo.SetCompletedWeek(ctx, userID, itemID, marker); err != nil {
		return nil, err
	}
	return s.GetWeeklyPlan(ctx, userID)
}
