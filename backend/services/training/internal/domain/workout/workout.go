package workout

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

type Workout struct {
	id          uuid.UUID
	userID      uuid.UUID
	name        string
	routineID   *uuid.UUID
	status      WorkoutStatus
	startedAt   time.Time
	finishedAt  *time.Time
	exercises   []*WorkoutExercise
	summary     *calc.WorkoutSummary
	events      []WorkoutFinishedEvent
}

func StartWorkout(userID uuid.UUID, name string, routineID *uuid.UUID, now time.Time) *Workout {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		trimmedName = "Workout on " + now.Format("Monday Afternoon")
	}

	return &Workout{
		id:        uuid.New(),
		userID:    userID,
		name:      trimmedName,
		routineID: routineID,
		status:    WorkoutStatusInProgress,
		startedAt: now,
		exercises: make([]*WorkoutExercise, 0),
		events:    make([]WorkoutFinishedEvent, 0),
	}
}

func StartFromRoutine(userID uuid.UUID, r *routine.Routine, now time.Time) *Workout {
	w := StartWorkout(userID, r.Name(), &[]uuid.UUID{r.ID()}[0], now)
	for idx, re := range r.Exercises() {
		we := NewWorkoutExercise(re.ExerciseID(), re.ExerciseName(), "weight_reps", idx)
		targetReps := 10
		if re.TargetRepsMin() != nil && *re.TargetRepsMin() > 0 {
			targetReps = *re.TargetRepsMin()
		}
		for s := 1; s <= re.TargetSets(); s++ {
			// Prepopulate with default sets based on routine targets
			reps, _ := measure.NewReps(targetReps)
			we.AddSet(measure.SetTypeNormal, measure.ZeroWeight(), reps, nil, nil)
		}
		w.exercises = append(w.exercises, we)
	}
	return w
}

func Reconstitute(
	id uuid.UUID,
	userID uuid.UUID,
	name string,
	routineID *uuid.UUID,
	status WorkoutStatus,
	startedAt time.Time,
	finishedAt *time.Time,
	exercises []*WorkoutExercise,
	summary *calc.WorkoutSummary,
) *Workout {
	return &Workout{
		id:         id,
		userID:     userID,
		name:       name,
		routineID:  routineID,
		status:     status,
		startedAt:  startedAt,
		finishedAt: finishedAt,
		exercises:  exercises,
		summary:    summary,
		events:     make([]WorkoutFinishedEvent, 0),
	}
}

func (w *Workout) ID() uuid.UUID { return w.id }
func (w *Workout) UserID() uuid.UUID { return w.userID }
func (w *Workout) Name() string { return w.name }
func (w *Workout) RoutineID() *uuid.UUID { return w.routineID }
func (w *Workout) Status() WorkoutStatus { return w.status }
func (w *Workout) StartedAt() time.Time { return w.startedAt }
func (w *Workout) FinishedAt() *time.Time { return w.finishedAt }
func (w *Workout) Exercises() []*WorkoutExercise { return w.exercises }
func (w *Workout) Summary() *calc.WorkoutSummary { return w.summary }
func (w *Workout) Events() []WorkoutFinishedEvent { return w.events }
func (w *Workout) ClearEvents() { w.events = nil }

func (w *Workout) AddExercise(exerciseID uuid.UUID, exerciseName, measurementType string) (*WorkoutExercise, error) {
	if w.status != WorkoutStatusInProgress {
		return nil, ErrWorkoutNotInProgress
	}
	we := NewWorkoutExercise(exerciseID, exerciseName, measurementType, len(w.exercises))
	w.exercises = append(w.exercises, we)
	return we, nil
}

func (w *Workout) LogSet(exerciseID uuid.UUID, setType measure.SetType, weight measure.Weight, reps measure.Reps, rpe *measure.RPE, duration *measure.Duration) (*WorkoutSet, error) {
	if w.status != WorkoutStatusInProgress {
		return nil, ErrWorkoutNotInProgress
	}
	for _, ex := range w.exercises {
		if ex.ExerciseID() == exerciseID {
			return ex.AddSet(setType, weight, reps, rpe, duration), nil
		}
	}
	return nil, ErrExerciseNotInWorkout
}

func (w *Workout) UpdateSet(setID uuid.UUID, weight measure.Weight, reps measure.Reps, rpe *measure.RPE, setType measure.SetType, completed bool) error {
	if w.status != WorkoutStatusInProgress {
		return ErrWorkoutNotInProgress
	}
	for _, ex := range w.exercises {
		for _, s := range ex.sets {
			if s.ID() == setID {
				s.Update(weight, reps, rpe, setType, completed)
				return nil
			}
		}
	}
	return ErrSetNotFound
}

func (w *Workout) SetExercises(exercises []*WorkoutExercise) {
	w.exercises = exercises
}

func (w *Workout) Finish(now time.Time) (*calc.WorkoutSummary, error) {
	return w.FinishWithDuration(now, nil)
}

func (w *Workout) FinishWithDuration(now time.Time, customDurationSecs *int) (*calc.WorkoutSummary, error) {
	if w.status != WorkoutStatusInProgress {
		return nil, ErrWorkoutNotInProgress
	}

	var calcInputs []calc.SetCalculationInput
	var finishedExercises []FinishedExercise

	for _, ex := range w.exercises {
		var setDTOs []FinishedExerciseSet
		for _, s := range ex.sets {
			calcInputs = append(calcInputs, calc.SetCalculationInput{
				Weight:    s.Weight(),
				Reps:      s.Reps(),
				SetType:   s.SetType(),
				Completed: s.Completed(),
			})

			var e1rmFloat *float64
			if s.CalculatedE1RM() != nil {
				v := s.CalculatedE1RM().Kg()
				e1rmFloat = &v
			}
			var rpeFloat *float64
			if s.RPE() != nil {
				v := s.RPE().Value()
				rpeFloat = &v
			}

			setDTOs = append(setDTOs, FinishedExerciseSet{
				SetType:          s.SetType().String(),
				WeightKg:         s.Weight().Kg(),
				Reps:             s.Reps().Value(),
				RPE:              rpeFloat,
				Completed:        s.Completed(),
				CalculatedE1RMKg: e1rmFloat,
			})
		}
		finishedExercises = append(finishedExercises, FinishedExercise{
			ExerciseID:   ex.ExerciseID(),
			ExerciseName: ex.ExerciseName(),
			Sets:         setDTOs,
		})
	}

	durationSecs := int(now.Sub(w.startedAt).Seconds())
	if customDurationSecs != nil && *customDurationSecs > 0 {
		durationSecs = *customDurationSecs
	}
	if durationSecs < 0 {
		durationSecs = 0
	}
	durationVO := measure.NewDurationSeconds(durationSecs)

	summary := calc.SummarizeWorkout(calcInputs, durationVO)
	if summary.TotalCompletedSets == 0 {
		return nil, ErrWorkoutRequiresSets
	}

	w.status = WorkoutStatusFinished
	w.finishedAt = &now
	w.summary = &summary

	event := WorkoutFinishedEvent{
		EventID:            uuid.New(),
		OccurredAt:         now,
		UserID:             w.userID,
		WorkoutID:          w.id,
		DurationSeconds:    durationSecs,
		TotalVolumeKg:      summary.TotalVolume.Kg(),
		CompletedSetsCount: summary.TotalCompletedSets,
		Exercises:          finishedExercises,
		Summary:            summary,
	}

	w.events = append(w.events, event)
	return &summary, nil
}
