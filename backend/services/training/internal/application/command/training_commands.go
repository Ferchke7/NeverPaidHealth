package command

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type UpdateSetInput struct {
	WorkoutID       uuid.UUID
	UserID          uuid.UUID
	SetID           uuid.UUID
	WeightKg        float64
	Reps            int
	RPE             *float64
	SetType         string
	Completed       bool
	DurationSeconds *int
}

type UpdateSetHandler struct {
	workoutRepo application.WorkoutRepo
}

func NewUpdateSetHandler(repo application.WorkoutRepo) *UpdateSetHandler {
	return &UpdateSetHandler{workoutRepo: repo}
}

func (h *UpdateSetHandler) Handle(ctx context.Context, in UpdateSetInput) error {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return err
	}
	if in.UserID != uuid.Nil && w.UserID() != in.UserID {
		return workout.ErrWorkoutNotFound
	}

	st, err := measure.NewSetType(in.SetType)
	if err != nil {
		return err
	}
	weight, err := measure.NewWeightKg(in.WeightKg)
	if err != nil {
		return err
	}
	reps, err := measure.NewReps(in.Reps)
	if err != nil {
		return err
	}

	var rpeVO *measure.RPE
	if in.RPE != nil {
		r, err := measure.NewRPE(*in.RPE)
		if err != nil {
			return err
		}
		rpeVO = &r
	}

	if err := w.UpdateSet(in.SetID, weight, reps, rpeVO, st, in.Completed); err != nil {
		return err
	}

	return h.workoutRepo.Save(ctx, w)
}

type FinishSetInput struct {
	ID              uuid.UUID `json:"id"`
	SetNumber       int       `json:"set_number"`
	SetType         string    `json:"set_type"`
	WeightKg        float64   `json:"weight_kg"`
	Reps            int       `json:"reps"`
	RPE             *float64  `json:"rpe,omitempty"`
	DurationSeconds *int      `json:"duration_seconds,omitempty"`
	Completed       bool      `json:"completed"`
}

type FinishExerciseInput struct {
	ExerciseID      uuid.UUID        `json:"exercise_id"`
	ExerciseName    string           `json:"exercise_name"`
	MeasurementType string           `json:"measurement_type"`
	Notes           string           `json:"notes,omitempty"`
	Sets            []FinishSetInput `json:"sets"`
}

type FinishWorkoutInput struct {
	WorkoutID       uuid.UUID             `json:"workout_id"`
	UserID          uuid.UUID             `json:"user_id,omitempty"`
	DurationSeconds *int                  `json:"duration_seconds,omitempty"`
	Exercises       []FinishExerciseInput `json:"exercises,omitempty"`
}

type UpdateActiveWorkoutInput struct {
	WorkoutID uuid.UUID
	UserID    uuid.UUID
	RoutineID *uuid.UUID
	Name      string
	Exercises []FinishExerciseInput
}

type UpdateActiveWorkoutHandler struct {
	workoutRepo application.WorkoutRepo
}

func NewUpdateActiveWorkoutHandler(repo application.WorkoutRepo) *UpdateActiveWorkoutHandler {
	return &UpdateActiveWorkoutHandler{workoutRepo: repo}
}

func (h *UpdateActiveWorkoutHandler) Handle(ctx context.Context, in UpdateActiveWorkoutInput) (*workout.Workout, error) {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return nil, err
	}
	if in.UserID != uuid.Nil && w.UserID() != in.UserID {
		return nil, workout.ErrWorkoutNotFound
	}
	if w.Status() != workout.WorkoutStatusInProgress {
		return nil, workout.ErrWorkoutNotInProgress
	}

	if in.Name != "" {
		w.Rename(in.Name)
	}
	if in.RoutineID != nil {
		w.SetRoutineID(in.RoutineID)
	}
	if in.Exercises != nil {
		w.SetExercises(buildWorkoutExercises(in.Exercises))
	}

	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, fmt.Errorf("failed updating active workout: %w", err)
	}
	return w, nil
}

func buildWorkoutExercises(inputs []FinishExerciseInput) []*workout.WorkoutExercise {
	exList := make([]*workout.WorkoutExercise, 0, len(inputs))
	for idx, exIn := range inputs {
		measType := exIn.MeasurementType
		if measType == "" {
			measType = "weight_reps"
		}
		name := exIn.ExerciseName
		if name == "" {
			name = "Exercise"
		}
		we := workout.NewWorkoutExercise(exIn.ExerciseID, name, measType, idx)
		we.SetNotes(exIn.Notes)
		for sIdx, sIn := range exIn.Sets {
			st, err := measure.NewSetType(sIn.SetType)
			if err != nil {
				st = measure.SetTypeNormal
			}
			wKg, err := measure.NewWeightKg(sIn.WeightKg)
			if err != nil {
				wKg = measure.ZeroWeight()
			}
			reps, err := measure.NewReps(sIn.Reps)
			if err != nil {
				reps, _ = measure.NewReps(0)
			}
			var rpe *measure.RPE
			if sIn.RPE != nil {
				if r, err := measure.NewRPE(*sIn.RPE); err == nil {
					rpe = &r
				}
			}
			var dur *measure.Duration
			if sIn.DurationSeconds != nil {
				d := measure.NewDurationSeconds(*sIn.DurationSeconds)
				dur = &d
			}
			setNum := sIn.SetNumber
			if setNum <= 0 {
				setNum = sIdx + 1
			}
			sID := sIn.ID
			if sID == uuid.Nil {
				sID = uuid.New()
			}
			e1rm := calc.CalculateE1RM(wKg, reps)
			we.AppendSet(workout.ReconstituteSet(sID, setNum, st, wKg, reps, rpe, dur, sIn.Completed, e1rm))
		}
		exList = append(exList, we)
	}
	return exList
}

type FinishWorkoutHandler struct {
	workoutRepo application.WorkoutRepo
	outboxRepo  application.OutboxRepo
	clock       application.Clock
}

func NewFinishWorkoutHandler(repo application.WorkoutRepo, outbox application.OutboxRepo, clock application.Clock) *FinishWorkoutHandler {
	return &FinishWorkoutHandler{workoutRepo: repo, outboxRepo: outbox, clock: clock}
}

func (h *FinishWorkoutHandler) Handle(ctx context.Context, in FinishWorkoutInput) (*workout.Workout, error) {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return nil, err
	}
	if in.UserID != uuid.Nil && w.UserID() != in.UserID {
		return nil, workout.ErrWorkoutNotFound
	}

	if len(in.Exercises) > 0 {
		w.SetExercises(buildWorkoutExercises(in.Exercises))
	}

	now := h.clock.Now()
	if _, err := w.FinishWithDuration(now, in.DurationSeconds); err != nil {
		return nil, err
	}

	// Persist updated workout
	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, fmt.Errorf("failed saving finished workout: %w", err)
	}

	// Save domain events to Transactional Outbox
	for _, event := range w.Events() {
		msg, err := outbox.NewMessage("WORKOUT.finished", event)
		if err != nil {
			return nil, fmt.Errorf("failed creating outbox message: %w", err)
		}
		if err := h.outboxRepo.Save(ctx, msg); err != nil {
			return nil, fmt.Errorf("failed saving to outbox: %w", err)
		}
	}
	w.ClearEvents()

	return w, nil
}

type CreateRoutineInput struct {
	ID        *uuid.UUID
	UserID    uuid.UUID
	Name      string
	Notes     string
	NotesPtr  *string
	Exercises []RoutineExerciseInput
}

type UpdateRoutineInput struct {
	UserID    uuid.UUID
	RoutineID uuid.UUID
	Name      string
	Notes     *string
	Exercises []RoutineExerciseInput
}

type RoutineExerciseInput struct {
	ExerciseID    uuid.UUID `json:"exercise_id"`
	ExerciseName  string    `json:"exercise_name"`
	TargetSets    int       `json:"target_sets"`
	TargetReps    *int      `json:"target_reps,omitempty"`
	TargetRepsMin *int      `json:"target_reps_min,omitempty"`
	TargetRepsMax *int      `json:"target_reps_max,omitempty"`
}

func buildRoutineExercises(inputs []RoutineExerciseInput) ([]*routine.RoutineExercise, error) {
	exercises := make([]*routine.RoutineExercise, 0, len(inputs))
	for idx, ex := range inputs {
		repsMin := ex.TargetRepsMin
		repsMax := ex.TargetRepsMax
		if repsMin == nil && repsMax == nil && ex.TargetReps != nil && *ex.TargetReps > 0 {
			val := *ex.TargetReps
			repsMin = &val
			repsMax = &val
		}
		re, err := routine.NewRoutineExercise(ex.ExerciseID, ex.ExerciseName, idx, ex.TargetSets, repsMin, repsMax)
		if err != nil {
			return nil, err
		}
		exercises = append(exercises, re)
	}
	return exercises, nil
}

func findMatchingPersonalRoutine(routines []*routine.Routine, userID uuid.UUID, names ...string) *routine.Routine {
	targets := make(map[string]struct{}, len(names))
	for _, n := range names {
		if norm := routine.NormalizeBaseName(n); norm != "" {
			targets[norm] = struct{}{}
		}
	}
	var best *routine.Routine
	for _, cand := range routines {
		if cand.UserID() != userID {
			continue
		}
		if _, ok := targets[routine.NormalizeBaseName(cand.Name())]; !ok {
			continue
		}
		if best == nil || cand.UpdatedAt().After(best.UpdatedAt()) ||
			(cand.UpdatedAt().Equal(best.UpdatedAt()) && cand.CreatedAt().After(best.CreatedAt())) {
			best = cand
		}
	}
	return best
}

// saveOrForkRoutine updates an owned routine in-place or lazily forks/reuses one personal copy
// when customizing a shared system template so rapid edits never accumulate duplicate copies.
func saveOrForkRoutine(
	ctx context.Context,
	repo application.RoutineRepo,
	clock application.Clock,
	userID uuid.UUID,
	targetID uuid.UUID,
	name string,
	notes *string,
	exerciseInputs []RoutineExerciseInput,
	requireExisting bool,
) (*routine.Routine, error) {
	exercises, err := buildRoutineExercises(exerciseInputs)
	if err != nil {
		return nil, err
	}
	now := clock.Now()

	existing, err := repo.GetByID(ctx, targetID)
	if err != nil {
		if !errors.Is(err, routine.ErrRoutineNotFound) {
			return nil, err
		}
		if requireExisting {
			return nil, routine.ErrRoutineNotFound
		}
		allRoutines, listErr := repo.ListByUserID(ctx, userID)
		if listErr == nil {
			if match := findMatchingPersonalRoutine(allRoutines, userID, name); match != nil {
				effectiveNotes := match.Notes()
				if notes != nil {
					effectiveNotes = *notes
				}
				if err := match.Update(name, effectiveNotes, exercises, now); err != nil {
					return nil, err
				}
				if err := repo.Save(ctx, match); err != nil {
					return nil, err
				}
				return match, nil
			}
		}
		initialNotes := ""
		if notes != nil {
			initialNotes = *notes
		}
		r, err := routine.NewRoutine(userID, name, initialNotes, exercises, now)
		if err != nil {
			return nil, err
		}
		if err := repo.Save(ctx, r); err != nil {
			return nil, err
		}
		return r, nil
	}

	if existing.UserID() == userID {
		effectiveNotes := existing.Notes()
		if notes != nil {
			effectiveNotes = *notes
		}
		if err := existing.Update(name, effectiveNotes, exercises, now); err != nil {
			return nil, err
		}
		if err := repo.Save(ctx, existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	if !existing.IsSystem() {
		return nil, routine.ErrUnauthorizedRoutineEdit
	}

	allRoutines, listErr := repo.ListByUserID(ctx, userID)
	if listErr == nil {
		if personal := findMatchingPersonalRoutine(allRoutines, userID, existing.Name(), name); personal != nil {
			effectiveNotes := personal.Notes()
			if notes != nil {
				effectiveNotes = *notes
			} else if strings.TrimSpace(effectiveNotes) == "" {
				effectiveNotes = existing.Notes()
			}
			effectiveName := name
			// Automated workout sync omits notes; keep user's chosen personal title if base name matches.
			if notes == nil && strings.TrimSpace(personal.Name()) != "" &&
				routine.NormalizeBaseName(personal.Name()) == routine.NormalizeBaseName(name) {
				effectiveName = personal.Name()
			}
			if err := personal.Update(effectiveName, effectiveNotes, exercises, now); err != nil {
				return nil, err
			}
			if err := repo.Save(ctx, personal); err != nil {
				return nil, err
			}
			return personal, nil
		}
	}

	initialNotes := existing.Notes()
	if notes != nil {
		initialNotes = *notes
	}
	forked, err := routine.NewRoutine(userID, name, initialNotes, exercises, now)
	if err != nil {
		return nil, err
	}
	if err := repo.Save(ctx, forked); err != nil {
		return nil, err
	}
	return forked, nil
}

type CreateRoutineHandler struct {
	routineRepo application.RoutineRepo
	clock       application.Clock
}

func NewCreateRoutineHandler(repo application.RoutineRepo, clock application.Clock) *CreateRoutineHandler {
	return &CreateRoutineHandler{routineRepo: repo, clock: clock}
}

func (h *CreateRoutineHandler) Handle(ctx context.Context, in CreateRoutineInput) (*routine.Routine, error) {
	if in.ID != nil && *in.ID != uuid.Nil {
		notesPtr := in.NotesPtr
		if notesPtr == nil && in.Notes != "" {
			val := in.Notes
			notesPtr = &val
		}
		return saveOrForkRoutine(ctx, h.routineRepo, h.clock, in.UserID, *in.ID, in.Name, notesPtr, in.Exercises, false)
	}

	exercises, err := buildRoutineExercises(in.Exercises)
	if err != nil {
		return nil, err
	}

	notes := in.Notes
	if in.NotesPtr != nil {
		notes = *in.NotesPtr
	}
	r, err := routine.NewRoutine(in.UserID, in.Name, notes, exercises, h.clock.Now())
	if err != nil {
		return nil, err
	}

	if err := h.routineRepo.Save(ctx, r); err != nil {
		return nil, err
	}

	return r, nil
}

type UpdateRoutineHandler struct {
	routineRepo application.RoutineRepo
	clock       application.Clock
}

func NewUpdateRoutineHandler(repo application.RoutineRepo, clock application.Clock) *UpdateRoutineHandler {
	return &UpdateRoutineHandler{routineRepo: repo, clock: clock}
}

func (h *UpdateRoutineHandler) Handle(ctx context.Context, in UpdateRoutineInput) (*routine.Routine, error) {
	return saveOrForkRoutine(ctx, h.routineRepo, h.clock, in.UserID, in.RoutineID, in.Name, in.Notes, in.Exercises, true)
}

type DeleteRoutineHandler struct {
	routineRepo application.RoutineRepo
}

func NewDeleteRoutineHandler(repo application.RoutineRepo) *DeleteRoutineHandler {
	return &DeleteRoutineHandler{routineRepo: repo}
}

func (h *DeleteRoutineHandler) Handle(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	r, err := h.routineRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if r.UserID() == uuid.Nil {
		return errors.New("cannot delete system routine")
	}
	if userID != uuid.Nil && r.UserID() != userID {
		return routine.ErrRoutineNotFound
	}
	return h.routineRepo.Delete(ctx, id)
}

type DeleteWorkoutHandler struct {
	workoutRepo application.WorkoutRepo
}

func NewDeleteWorkoutHandler(repo application.WorkoutRepo) *DeleteWorkoutHandler {
	return &DeleteWorkoutHandler{workoutRepo: repo}
}

func (h *DeleteWorkoutHandler) Handle(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	w, err := h.workoutRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if userID != uuid.Nil && w.UserID() != userID {
		return workout.ErrWorkoutNotFound
	}
	return h.workoutRepo.Delete(ctx, id)
}

type ReorderRoutinesHandler struct {
	routineRepo application.RoutineRepo
}

func NewReorderRoutinesHandler(repo application.RoutineRepo) *ReorderRoutinesHandler {
	return &ReorderRoutinesHandler{routineRepo: repo}
}

func (h *ReorderRoutinesHandler) Handle(ctx context.Context, userID uuid.UUID, orderedIDs []uuid.UUID) ([]*routine.Routine, error) {
	all, err := h.routineRepo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	byID := make(map[uuid.UUID]*routine.Routine, len(all))
	var userOwned []*routine.Routine
	for _, rot := range all {
		if rot.UserID() == userID && !rot.IsSystem() {
			byID[rot.ID()] = rot
			userOwned = append(userOwned, rot)
		}
	}

	seen := make(map[uuid.UUID]bool, len(userOwned))
	ordered := make([]*routine.Routine, 0, len(userOwned))
	for _, id := range orderedIDs {
		if rot, ok := byID[id]; ok && !seen[id] {
			seen[id] = true
			ordered = append(ordered, rot)
		}
	}
	for _, rot := range userOwned {
		if !seen[rot.ID()] {
			seen[rot.ID()] = true
			ordered = append(ordered, rot)
		}
	}

	for idx, rot := range ordered {
		if rot.SortOrder() != idx {
			rot.SetSortOrder(idx)
			if err := h.routineRepo.Save(ctx, rot); err != nil {
				return nil, err
			}
		}
	}

	return h.routineRepo.ListByUserID(ctx, userID)
}


