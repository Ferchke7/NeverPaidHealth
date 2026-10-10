package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/application/query"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type Handler struct {
	startWorkoutCmd  *command.StartWorkoutHandler
	addExerciseCmd   *command.AddExerciseHandler
	logSetCmd        *command.LogSetHandler
	updateSetCmd     *command.UpdateSetHandler
	finishWorkoutCmd *command.FinishWorkoutHandler
	createRoutineCmd *command.CreateRoutineHandler
	deleteRoutineCmd *command.DeleteRoutineHandler
	deleteWorkoutCmd *command.DeleteWorkoutHandler
	queries          *query.TrainingQueriesHandler
}

func NewHandler(
	startWorkout *command.StartWorkoutHandler,
	addExercise *command.AddExerciseHandler,
	logSet *command.LogSetHandler,
	updateSet *command.UpdateSetHandler,
	finishWorkout *command.FinishWorkoutHandler,
	createRoutine *command.CreateRoutineHandler,
	deleteRoutine *command.DeleteRoutineHandler,
	deleteWorkout *command.DeleteWorkoutHandler,
	queries *query.TrainingQueriesHandler,
) *Handler {
	return &Handler{
		startWorkoutCmd:  startWorkout,
		addExerciseCmd:   addExercise,
		logSetCmd:        logSet,
		updateSetCmd:     updateSet,
		finishWorkoutCmd: finishWorkout,
		createRoutineCmd: createRoutine,
		deleteRoutineCmd: deleteRoutine,
		deleteWorkoutCmd: deleteWorkout,
		queries:          queries,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	// Routines
	r.Get("/routines", httpx.RequireAuth(h.handleListRoutines))
	r.Post("/routines", httpx.RequireAuth(h.handleCreateRoutine))
	r.Get("/routines/{id}", httpx.RequireAuth(h.handleGetRoutineByID))
	r.Delete("/routines/{id}", httpx.RequireAuth(h.handleDeleteRoutine))

	// Workouts
	r.Get("/workouts", httpx.RequireAuth(h.handleListWorkouts))
	r.Post("/workouts", httpx.RequireAuth(h.handleStartWorkout))
	r.Get("/workouts/active", httpx.RequireAuth(h.handleGetActiveWorkout))
	r.Get("/workouts/{id}", httpx.RequireAuth(h.handleGetWorkoutByID))
	r.Delete("/workouts/{id}", httpx.RequireAuth(h.handleCancelWorkout))
	r.Post("/workouts/{id}/cancel", httpx.RequireAuth(h.handleCancelWorkout))
	r.Post("/workouts/{id}/finish", httpx.RequireAuth(h.handleFinishWorkout))
	r.Post("/workouts/{id}/exercises", httpx.RequireAuth(h.handleAddExercise))
	r.Post("/workouts/{id}/exercises/{exerciseId}/sets", httpx.RequireAuth(h.handleLogSet))
	r.Put("/workouts/{id}/sets/{setId}", httpx.RequireAuth(h.handleUpdateSet))

	return r
}

type startWorkoutReq struct {
	RoutineID *string `json:"routine_id,omitempty"`
	Name      string  `json:"name,omitempty"`
}

type addExerciseReq struct {
	ExerciseID string `json:"exercise_id"`
}

type logSetReq struct {
	SetType         string   `json:"set_type"`
	WeightKg        float64  `json:"weight_kg"`
	Reps            int      `json:"reps"`
	RPE             *float64 `json:"rpe,omitempty"`
	DurationSeconds *int     `json:"duration_seconds,omitempty"`
}

type updateSetReq struct {
	SetType         string   `json:"set_type"`
	WeightKg        float64  `json:"weight_kg"`
	Reps            int      `json:"reps"`
	RPE             *float64 `json:"rpe,omitempty"`
	DurationSeconds *int     `json:"duration_seconds,omitempty"`
	Completed       bool     `json:"completed"`
}

type createRoutineReq struct {
	Name      string                         `json:"name"`
	Notes     string                         `json:"notes,omitempty"`
	Exercises []command.RoutineExerciseInput `json:"exercises"`
}

func (h *Handler) handleStartWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var req startWorkoutReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	var rotID *uuid.UUID
	if req.RoutineID != nil && *req.RoutineID != "" {
		if parsed, err := uuid.Parse(*req.RoutineID); err == nil {
			rotID = &parsed
		}
	}

	workoutRes, err := h.startWorkoutCmd.Handle(r.Context(), command.StartWorkoutInput{
		UserID:    userID,
		RoutineID: rotID,
		Name:      req.Name,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_START_WORKOUT")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapWorkoutDTO(workoutRes))
}

func (h *Handler) handleGetActiveWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	active, err := h.queries.GetActiveWorkout(r.Context(), userID)
	if err != nil {
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

	dtos := make([]any, 0)
	for _, wItem := range workouts {
		dtos = append(dtos, mapWorkoutDTO(wItem))
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": dtos})
}

type finishWorkoutReq struct {
	DurationSeconds *int                          `json:"duration_seconds,omitempty"`
	Exercises       []command.FinishExerciseInput `json:"exercises,omitempty"`
}

func (h *Handler) handleFinishWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	var req finishWorkoutReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	finished, err := h.finishWorkoutCmd.Handle(r.Context(), command.FinishWorkoutInput{
		WorkoutID:       id,
		DurationSeconds: req.DurationSeconds,
		Exercises:       req.Exercises,
	})
	if err != nil {
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
		SetID:           setID,
		WeightKg:        req.WeightKg,
		Reps:            req.Reps,
		RPE:             req.RPE,
		SetType:         req.SetType,
		Completed:       req.Completed,
		DurationSeconds: req.DurationSeconds,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPDATE_SET")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleListRoutines(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	routines, err := h.queries.ListRoutines(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0)
	for _, rot := range routines {
		dtos = append(dtos, mapRoutineDTO(rot))
	}
	httpx.WriteJSON(w, http.StatusOK, dtos)
}

func (h *Handler) handleCreateRoutine(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[createRoutineReq](w, r)
	if !ok {
		return
	}

	rot, err := h.createRoutineCmd.Handle(r.Context(), command.CreateRoutineInput{
		UserID:    userID,
		Name:      req.Name,
		Notes:     req.Notes,
		Exercises: req.Exercises,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_CREATE_ROUTINE")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapRoutineDTO(rot))
}

func (h *Handler) handleGetRoutineByID(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	rot, err := h.queries.GetRoutineByID(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Routine not found", "ERR_NOT_FOUND")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapRoutineDTO(rot))
}

func (h *Handler) handleDeleteRoutine(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.deleteRoutineCmd.Handle(r.Context(), id); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_DELETE_ROUTINE")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleCancelWorkout(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.deleteWorkoutCmd.Handle(r.Context(), id); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_CANCEL_WORKOUT")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func mapWorkoutDTO(w *workout.Workout) map[string]any {
	var exList []any
	for _, ex := range w.Exercises() {
		exList = append(exList, mapExerciseDTO(ex))
	}

	var vol *float64
	var count *int
	var dur *int

	if w.Summary() != nil {
		v := w.Summary().TotalVolume.Kg()
		vol = &v
		c := w.Summary().TotalCompletedSets
		count = &c
		d := w.Summary().Duration.Seconds()
		dur = &d
	}

	var finStr *string
	if w.FinishedAt() != nil {
		s := w.FinishedAt().Format("2006-01-02T15:04:05Z07:00")
		finStr = &s
	}

	return map[string]any{
		"id":                   w.ID().String(),
		"user_id":              w.UserID().String(),
		"name":                 w.Name(),
		"routine_id":           w.RoutineID(),
		"status":               string(w.Status()),
		"started_at":           w.StartedAt().Format("2006-01-02T15:04:05Z07:00"),
		"finished_at":          finStr,
		"total_volume_kg":      vol,
		"completed_sets_count": count,
		"duration_seconds":     dur,
		"exercises":            exList,
	}
}

func mapExerciseDTO(ex *workout.WorkoutExercise) map[string]any {
	var setsList []any
	for _, s := range ex.Sets() {
		setsList = append(setsList, mapSetDTO(s))
	}
	return map[string]any{
		"exercise_id":      ex.ExerciseID().String(),
		"exercise_name":    ex.ExerciseName(),
		"measurement_type": ex.MeasurementType(),
		"order_index":      ex.OrderIndex(),
		"sets":             setsList,
	}
}

func mapSetDTO(s *workout.WorkoutSet) map[string]any {
	var rpeVal *float64
	if s.RPE() != nil {
		v := s.RPE().Value()
		rpeVal = &v
	}
	var durVal *int
	if s.Duration() != nil {
		v := s.Duration().Seconds()
		durVal = &v
	}
	var e1rmVal *float64
	if s.CalculatedE1RM() != nil {
		v := s.CalculatedE1RM().Kg()
		e1rmVal = &v
	}

	return map[string]any{
		"id":                 s.ID().String(),
		"set_number":         s.SetNumber(),
		"set_type":           s.SetType().String(),
		"weight_kg":          s.Weight().Kg(),
		"reps":               s.Reps().Value(),
		"rpe":                rpeVal,
		"duration_seconds":   durVal,
		"completed":          s.Completed(),
		"calculated_e1rm_kg": e1rmVal,
	}
}

func mapRoutineDTO(r *routine.Routine) map[string]any {
	var exList []any
	for _, ex := range r.Exercises() {
		exList = append(exList, map[string]any{
			"exercise_id":     ex.ExerciseID().String(),
			"exercise_name":   ex.ExerciseName(),
			"order_index":     ex.OrderIndex(),
			"target_sets":     ex.TargetSets(),
			"target_reps_min": ex.TargetRepsMin(),
			"target_reps_max": ex.TargetRepsMax(),
		})
	}
	return map[string]any{
		"id":         r.ID().String(),
		"user_id":    r.UserID().String(),
		"name":       r.Name(),
		"notes":      r.Notes(),
		"exercises":  exList,
		"created_at": r.CreatedAt().Format("2006-01-02T15:04:05Z07:00"),
	}
}
