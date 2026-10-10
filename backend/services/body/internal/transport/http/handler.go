package http

import (
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

	registerRoutes := func(router chi.Router) {
		router.Get("/logs", httpx.RequireAuth(h.handleListLogs))
		router.Post("/logs", httpx.RequireAuth(h.handleLogMeasurement))
		router.Delete("/logs/{date}", httpx.RequireAuth(h.handleDeleteLog))
		router.Get("/trend", httpx.RequireAuth(h.handleGetTrend))
	}

	registerRoutes(r)
	r.Route("/body", registerRoutes)

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

type BodyLogResponse struct {
	ID                string   `json:"id"`
	UserID            string   `json:"user_id"`
	LogDate           string   `json:"log_date"`
	WeightKg          float64  `json:"weight_kg"`
	BodyFatPercentage *float64 `json:"body_fat_percentage"`
	WaistCm           *float64 `json:"waist_cm"`
	ChestCm           *float64 `json:"chest_cm"`
	ArmsCm            *float64 `json:"arms_cm"`
	ThighsCm          *float64 `json:"thighs_cm"`
	CalvesCm          *float64 `json:"calves_cm"`
	NeckCm            *float64 `json:"neck_cm"`
	CalculatedBMI     *float64 `json:"calculated_bmi"`
}

func (h *Handler) handleListLogs(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	fromDate := httpx.QueryString(r, "from_date", "")
	toDate := httpx.QueryString(r, "to_date", "")

	logs, err := h.queries.ListLogs(r.Context(), userID, fromDate, toDate)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	resp := make([]BodyLogResponse, len(logs))
	for i, l := range logs {
		resp[i] = toBodyLogResponse(l)
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) handleLogMeasurement(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[logMeasurementReq](w, r)
	if !ok {
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

	httpx.WriteJSON(w, http.StatusOK, toBodyLogResponse(log))
}

func (h *Handler) handleDeleteLog(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	date := chi.URLParam(r, "date")
	if date == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Date parameter required", "ERR_MISSING_PARAM")
		return
	}

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

func toBodyLogResponse(l *body.BodyLog) BodyLogResponse {
	var bf *float64
	if l.BodyFat() != nil {
		v := l.BodyFat().Value()
		bf = &v
	}
	vals := l.Circumferences().Values()

	return BodyLogResponse{
		ID:                l.ID().String(),
		UserID:            l.UserID().String(),
		LogDate:           l.LogDate(),
		WeightKg:          l.Weight().Kg(),
		BodyFatPercentage: bf,
		WaistCm:           vals.Waist,
		ChestCm:           vals.Chest,
		ArmsCm:            vals.Arms,
		ThighsCm:          vals.Thighs,
		CalvesCm:          vals.Calves,
		NeckCm:            vals.Neck,
		CalculatedBMI:     l.CalculatedBMI(),
	}
}
