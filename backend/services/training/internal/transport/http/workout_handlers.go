package http

import (
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

func (h *Handler) handleStartWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[startWorkoutReq](w, r)
	if !ok {
		return
	}

	var clientID *uuid.UUID
	if req.ID != nil && *req.ID != "" {
		parsed, err := uuid.Parse(*req.ID)
		if err != nil {
			httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid workout ID", "ERR_INVALID_UUID")
			return
		}
		clientID = &parsed
	}

	var rotID *uuid.UUID
	if req.RoutineID != nil && *req.RoutineID != "" {
		if parsed, err := uuid.Parse(*req.RoutineID); err == nil {
			rotID = &parsed
		}
	}

	workoutRes, err := h.startWorkoutCmd.Handle(r.Context(), command.StartWorkoutInput{
		ID:            clientID,
		UserID:        userID,
		RoutineID:     rotID,
		Name:          req.Name,
		ReplaceActive: req.ReplaceActive,
	})
	if err != nil {
		var activeErr *command.ActiveWorkoutExistsError
		if errors.As(err, &activeErr) {
			httpx.WriteJSON(w, http.StatusConflict, map[string]any{
				"code":  "ERR_ACTIVE_WORKOUT_EXISTS",
				"error": "Active workout already exists",
				"active": map[string]any{
					"id":         activeErr.Active.ID().String(),
					"name":       activeErr.Active.Name(),
					"started_at": activeErr.Active.StartedAt().Format("2006-01-02T15:04:05Z07:00"),
				},
			})
			return
		}
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_START_WORKOUT")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapWorkoutDTO(workoutRes))
}

func (h *Handler) handleGetActiveWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	active, err := h.queries.GetActiveWorkout(r.Context(), userID)
	if err != nil {
		if errors.Is(err, workout.ErrWorkoutNotFound) {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}
	if active == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapWorkoutDTO(active))
}

func (h *Handler) handleGetWorkoutByID(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	res, err := h.queries.GetWorkoutByID(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Workout not found", "ERR_NOT_FOUND")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapWorkoutDTO(res))
}

func (h *Handler) handleListWorkouts(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	limit := httpx.QueryInt(r, "limit", 50)
	offset := httpx.QueryInt(r, "offset", 0)

	workouts, err := h.queries.ListWorkouts(r.Context(), userID, limit, offset)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0, len(workouts))
	for _, wItem := range workouts {
		dtos = append(dtos, mapWorkoutDTO(wItem))
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": dtos})
}

func (h *Handler) handleFinishWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	req, ok := httpx.DecodeJSON[finishWorkoutReq](w, r)
	if !ok {
		return
	}

	cmdExercises := make([]command.FinishExerciseInput, 0, len(req.Exercises))
	for _, ex := range req.Exercises {
		exUUID, err := uuid.Parse(ex.ExerciseID)
		if err != nil {
			httpx.WriteProblem(w, http.StatusUnprocessableEntity, "Unprocessable Entity", "Invalid exercise_id format", "ERR_INVALID_EXERCISE_ID")
			return
		}
		cmdExercises = append(cmdExercises, command.FinishExerciseInput{
			ExerciseID:      exUUID,
			ExerciseName:    ex.ExerciseName,
			MeasurementType: ex.MeasurementType,
			Notes:           ex.Notes,
			Sets:            ex.Sets,
		})
	}

	finished, err := h.finishWorkoutCmd.Handle(r.Context(), command.FinishWorkoutInput{
		WorkoutID:       id,
		UserID:          userID,
		DurationSeconds: req.DurationSeconds,
		Exercises:       cmdExercises,
	})
	if err != nil {
		if errors.Is(err, workout.ErrWorkoutNotFound) {
			httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Workout not found", "ERR_NOT_FOUND")
			return
		}
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_FINISH_WORKOUT")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapWorkoutDTO(finished))
}

func (h *Handler) handleAddExercise(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	workoutID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	req, ok := httpx.DecodeJSON[addExerciseReq](w, r)
	if !ok {
		return
	}

	exID, err := uuid.Parse(req.ExerciseID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid Exercise ID", "ERR_INVALID_UUID")
		return
	}

	we, err := h.addExerciseCmd.Handle(r.Context(), command.AddExerciseInput{WorkoutID: workoutID, ExerciseID: exID})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_ADD_EXERCISE")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapExerciseDTO(we))
}

func (h *Handler) handleLogSet(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	workoutID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}
	exerciseID, ok := httpx.PathUUID(w, r, "exerciseId")
	if !ok {
		return
	}

	req, ok := httpx.DecodeJSON[logSetReq](w, r)
	if !ok {
		return
	}

	set, err := h.logSetCmd.Handle(r.Context(), command.LogSetInput{
		WorkoutID:       workoutID,
		ExerciseID:      exerciseID,
		SetType:         req.SetType,
		WeightKg:        req.WeightKg,
		Reps:            req.Reps,
		RPE:             req.RPE,
		DurationSeconds: req.DurationSeconds,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_LOG_SET")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapSetDTO(set))
}

func (h *Handler) handleUpdateSet(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	workoutID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}
	setID, ok := httpx.PathUUID(w, r, "setId")
	if !ok {
		return
	}

	req, ok := httpx.DecodeJSON[updateSetReq](w, r)
	if !ok {
		return
	}

	err := h.updateSetCmd.Handle(r.Context(), command.UpdateSetInput{
		WorkoutID:       workoutID,
		UserID:          userID,
		SetID:           setID,
		WeightKg:        req.WeightKg,
		Reps:            req.Reps,
		RPE:             req.RPE,
		SetType:         req.SetType,
		Completed:       req.Completed,
		DurationSeconds: req.DurationSeconds,
	})
	if err != nil {
		if errors.Is(err, workout.ErrWorkoutNotFound) {
			httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Workout not found", "ERR_NOT_FOUND")
			return
		}
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPDATE_SET")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleCancelWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.deleteWorkoutCmd.Handle(r.Context(), userID, id); err != nil {
		if errors.Is(err, workout.ErrWorkoutNotFound) {
			httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Workout not found", "ERR_NOT_FOUND")
			return
		}
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_CANCEL_WORKOUT")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleGetPreviousSets(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	exParam := httpx.QueryString(r, "exercise_ids", "")
	nameParam := httpx.QueryString(r, "exercise_names", "")
	if exParam == "" && nameParam == "" {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": map[string]any{}, "notes": map[string]any{}})
		return
	}

	var exIDs []uuid.UUID
	if exParam != "" {
		for _, p := range strings.Split(exParam, ",") {
			trimmed := strings.TrimSpace(p)
			if id, err := uuid.Parse(trimmed); err == nil {
				exIDs = append(exIDs, id)
			}
		}
	}

	var exNames []string
	if nameParam != "" {
		for _, p := range strings.Split(nameParam, ",") {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				exNames = append(exNames, trimmed)
			}
		}
	}

	previous, err := h.queries.GetPreviousSets(r.Context(), userID, exIDs, exNames)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	previousNotes, _ := h.queries.GetPreviousNotes(r.Context(), userID, exIDs, exNames)
	if previousNotes == nil {
		previousNotes = make(map[string]workout.PreviousExerciseNote)
	}

	items := make(map[string]any)
	for key, sets := range previous {
		var setDTOs []any
		for _, s := range sets {
			setDTOs = append(setDTOs, mapSetDTO(s))
		}
		items[key] = setDTOs
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"notes": previousNotes,
	})
}
