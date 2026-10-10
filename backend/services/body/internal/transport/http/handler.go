package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/body/internal/application/command"
	"github.com/neverpaidhealth/backend/services/body/internal/application/query"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

type Handler struct {
	logCmd    *command.LogBodyMeasurementHandler
	deleteCmd *command.DeleteBodyMeasurementHandler
	queries   *query.BodyQueriesHandler
}

func NewHandler(
	logCmd *command.LogBodyMeasurementHandler,
	deleteCmd *command.DeleteBodyMeasurementHandler,
	queries *query.BodyQueriesHandler,
) *Handler {
	return &Handler{
		logCmd:    logCmd,
		deleteCmd: deleteCmd,
		queries:   queries,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	r.Get("/logs", httpx.RequireAuth(h.handleListLogs))
	r.Get("/body/logs", httpx.RequireAuth(h.handleListLogs))
	r.Post("/logs", httpx.RequireAuth(h.handleLogMeasurement))
	r.Post("/body/logs", httpx.RequireAuth(h.handleLogMeasurement))
	r.Delete("/logs/{date}", httpx.RequireAuth(h.handleDeleteLog))
	r.Delete("/body/logs/{date}", httpx.RequireAuth(h.handleDeleteLog))
	r.Get("/trend", httpx.RequireAuth(h.handleGetTrend))
	r.Get("/body/trend", httpx.RequireAuth(h.handleGetTrend))

	return r
}

type logMeasurementReq struct {
	LogDate           string   `json:"log_date"`
	WeightKg          float64  `json:"weight_kg"`
	HeightCm          *float64 `json:"height_cm,omitempty"`
	BodyFatPercentage *float64 `json:"body_fat_percentage,omitempty"`
	WaistCm           *float64 `json:"waist_cm,omitempty"`
	ChestCm           *float64 `json:"chest_cm,omitempty"`
	ArmsCm            *float64 `json:"arms_cm,omitempty"`
	ThighsCm          *float64 `json:"thighs_cm,omitempty"`
	CalvesCm          *float64 `json:"calves_cm,omitempty"`
	NeckCm            *float64 `json:"neck_cm,omitempty"`
}

func (h *Handler) handleListLogs(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {

	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	logs, err := h.queries.ListLogs(r.Context(), userID, fromDate, toDate)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0)
	for _, l := range logs {
		dtos = append(dtos, mapBodyLogDTO(l))
	}

	httpx.WriteJSON(w, http.StatusOK, dtos)
}

func (h *Handler) handleLogMeasurement(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {

	var req logMeasurementReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON payload", "ERR_INVALID_BODY")
		return
	}

	log, err := h.logCmd.Handle(r.Context(), command.LogBodyMeasurementInput{
		UserID:            userID,
		LogDate:           req.LogDate,
		WeightKg:          req.WeightKg,
		HeightCm:          req.HeightCm,
		BodyFatPercentage: req.BodyFatPercentage,
		WaistCm:           req.WaistCm,
		ChestCm:           req.ChestCm,
		ArmsCm:            req.ArmsCm,
		ThighsCm:          req.ThighsCm,
		CalvesCm:          req.CalvesCm,
		NeckCm:            req.NeckCm,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_LOG_MEASUREMENT")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapBodyLogDTO(log))
}

func (h *Handler) handleDeleteLog(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {

	date := chi.URLParam(r, "date")
	if err := h.deleteCmd.Handle(r.Context(), userID, date); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleGetTrend(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {

	trend, err := h.queries.GetTrend(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, trend)
}

func mapBodyLogDTO(l *body.BodyLog) map[string]any {
	var bf *float64
	if l.BodyFat() != nil {
		v := l.BodyFat().Value()
		bf = &v
	}
	var waist, chest, arms, thighs, calves, neck *float64
	if l.Circumferences().Waist != nil {
		v := l.Circumferences().Waist.Cm()
		waist = &v
	}
	if l.Circumferences().Chest != nil {
		v := l.Circumferences().Chest.Cm()
		chest = &v
	}
	if l.Circumferences().Arms != nil {
		v := l.Circumferences().Arms.Cm()
		arms = &v
	}
	if l.Circumferences().Thighs != nil {
		v := l.Circumferences().Thighs.Cm()
		thighs = &v
	}
	if l.Circumferences().Calves != nil {
		v := l.Circumferences().Calves.Cm()
		calves = &v
	}
	if l.Circumferences().Neck != nil {
		v := l.Circumferences().Neck.Cm()
		neck = &v
	}

	return map[string]any{
		"id":                  l.ID().String(),
		"user_id":             l.UserID().String(),
		"log_date":            l.LogDate(),
		"weight_kg":           l.Weight().Kg(),
		"body_fat_percentage": bf,
		"waist_cm":            waist,
		"chest_cm":            chest,
		"arms_cm":             arms,
		"thighs_cm":           thighs,
		"calves_cm":           calves,
		"neck_cm":             neck,
		"calculated_bmi":      l.CalculatedBMI(),
	}
}
