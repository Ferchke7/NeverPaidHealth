package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/progress/internal/application/handler"
	"github.com/neverpaidhealth/backend/services/progress/internal/application/query"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/history"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

type Handler struct {
	queries           *query.ProgressQueriesHandler
	onFinishedHandler *handler.OnWorkoutFinishedHandler
}

func NewHandler(queries *query.ProgressQueriesHandler, onFinished *handler.OnWorkoutFinishedHandler) *Handler {
	return &Handler{
		queries:           queries,
		onFinishedHandler: onFinished,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	r.Get("/records", h.handleGetRecords)
	r.Get("/progress/records", h.handleGetRecords)
	r.Get("/history/{exerciseId}", h.handleGetExerciseHistory)
	r.Get("/progress/history/{exerciseId}", h.handleGetExerciseHistory)

	r.Post("/workouts", h.handleRecordFinishedWorkout)
	r.Post("/progress/workouts", h.handleRecordFinishedWorkout)
	r.Post("/sync", h.handleRecordFinishedWorkout)
	r.Post("/progress/sync", h.handleRecordFinishedWorkout)

	return r
}

func (h *Handler) handleRecordFinishedWorkout(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var evt handler.WorkoutFinishedEvent
	if err := json.NewDecoder(r.Body).Decode(&evt); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON", "ERR_INVALID_BODY")
		return
	}

	if evt.UserID == uuid.Nil {
		evt.UserID = userID
	}
	if evt.OccurredAt.IsZero() {
		evt.OccurredAt = time.Now()
	}
	if evt.EventID == uuid.Nil {
		evt.EventID = uuid.New()
	}

	if h.onFinishedHandler != nil {
		if err := h.onFinishedHandler.Handle(r.Context(), evt); err != nil {
			httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
			return
		}
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"status": "recorded"})
}

func (h *Handler) handleGetRecords(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	books, err := h.queries.GetPersonalRecords(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0)
	for _, b := range books {
		dtos = append(dtos, mapRecordBookDTO(b))
	}

	httpx.WriteJSON(w, http.StatusOK, dtos)
}

func (h *Handler) handleGetExerciseHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	exID, err := uuid.Parse(chi.URLParam(r, "exerciseId"))
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid Exercise ID", "ERR_INVALID_UUID")
		return
	}

	series, err := h.queries.GetExerciseHistorySeries(r.Context(), userID, exID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapHistorySeriesDTO(series))
}

func mapRecordBookDTO(b *record.ExerciseRecordBook) map[string]any {
	var recordsList []any
	for _, rec := range b.Records() {
		recordsList = append(recordsList, map[string]any{
			"pr_type":     string(rec.Type),
			"value":       rec.Value,
			"achieved_at": rec.AchievedAt.Format("2006-01-02T15:04:05Z07:00"),
			"workout_id":  rec.WorkoutID.String(),
		})
	}

	return map[string]any{
		"exercise_id":        b.ExerciseID().String(),
		"exercise_name":      b.ExerciseName(),
		"best_weight_kg":     b.BestWeightKg(),
		"best_e1rm_kg":       b.BestE1RMKg(),
		"max_volume_set_kg":  b.MaxVolumeSetKg(),
		"max_reps":           b.MaxReps(),
		"records":            recordsList,
	}
}

func mapHistorySeriesDTO(s *history.ExerciseHistorySeries) map[string]any {
	var pts []any
	for _, p := range s.DataPoints {
		pts = append(pts, map[string]any{
			"workout_id":                p.WorkoutID.String(),
			"date":                      p.Date.Format("2006-01-02"),
			"best_weight_kg":            p.BestWeightKg,
			"best_e1rm_kg":              p.BestE1RMKg,
			"total_exercise_volume_kg": p.TotalExerciseVolumeKg,
		})
	}

	return map[string]any{
		"exercise_id":   s.ExerciseID.String(),
		"exercise_name": s.ExerciseName,
		"data_points":   pts,
	}
}
