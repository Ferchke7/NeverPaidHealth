package http

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/command"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/query"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type Handler struct {
	createCustomHandler *command.CreateCustomExerciseHandler
	deleteCustomHandler *command.DeleteCustomExerciseHandler
	listHandler         *query.ListExercisesHandler
	getHandler          *query.GetExerciseHandler
}

func NewHandler(
	createCustom *command.CreateCustomExerciseHandler,
	deleteCustom *command.DeleteCustomExerciseHandler,
	list *query.ListExercisesHandler,
	get *query.GetExerciseHandler,
) *Handler {
	return &Handler{
		createCustomHandler: createCustom,
		deleteCustomHandler: deleteCustom,
		listHandler:         list,
		getHandler:          get,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	// Routes supporting both root and /exercises paths
	r.Get("/", h.handleList)
	r.Get("/exercises", h.handleList)
	r.Post("/", h.handleCreateCustom)
	r.Post("/exercises", h.handleCreateCustom)
	r.Get("/{id}", h.handleGetByID)
	r.Get("/exercises/{id}", h.handleGetByID)
	r.Delete("/{id}", h.handleDeleteCustom)
	r.Delete("/exercises/{id}", h.handleDeleteCustom)

	return r
}

type exerciseResponse struct {
	ID                    string   `json:"id"`
	Name                  string   `json:"name"`
	PrimaryMuscleGroup    string   `json:"primary_muscle_group"`
	SecondaryMuscleGroups []string `json:"secondary_muscle_groups"`
	Equipment             string   `json:"equipment"`
	MeasurementType       string   `json:"measurement_type"`
	IsCustom              bool     `json:"is_custom"`
	CreatedByUserID       *string  `json:"created_by_user_id,omitempty"`
}

type createExerciseReq struct {
	Name                  string   `json:"name"`
	PrimaryMuscleGroup    string   `json:"primary_muscle_group"`
	SecondaryMuscleGroups []string `json:"secondary_muscle_groups"`
	Equipment             string   `json:"equipment"`
	MeasurementType       string   `json:"measurement_type"`
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	userID, _ := httpx.UserIDFromContext(r.Context())

	var muscleGroup *string
	if mg := r.URL.Query().Get("muscle_group"); mg != "" {
		muscleGroup = &mg
	}

	var equipment *string
	if eq := r.URL.Query().Get("equipment"); eq != "" {
		equipment = &eq
	}

	search := r.URL.Query().Get("search")

	exercises, err := h.listHandler.Handle(r.Context(), query.ListExercisesQuery{
		UserID:         userID,
		MuscleGroupStr: muscleGroup,
		EquipmentStr:   equipment,
		SearchQuery:    search,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	var dtos []exerciseResponse
	for _, ex := range exercises {
		dtos = append(dtos, mapExerciseResponse(ex))
	}

	// Compute ETag for caching
	dataBytes, _ := json.Marshal(dtos)
	hash := sha256.Sum256(dataBytes)
	etag := fmt.Sprintf(`"%s"`, hex.EncodeToString(hash[:8]))

	if match := r.Header.Get("If-None-Match"); match != "" && match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "public, max-age=60")
	httpx.WriteJSON(w, http.StatusOK, dtos)
}

func (h *Handler) handleCreateCustom(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var req createExerciseReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON payload", "ERR_INVALID_BODY")
		return
	}

	ex, err := h.createCustomHandler.Handle(r.Context(), command.CreateCustomExerciseInput{
		UserID:                userID,
		Name:                  req.Name,
		PrimaryMuscleGroup:    req.PrimaryMuscleGroup,
		SecondaryMuscleGroups: req.SecondaryMuscleGroups,
		Equipment:             req.Equipment,
		MeasurementType:       req.MeasurementType,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_CREATE_EXERCISE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapExerciseResponse(ex))
}

func (h *Handler) handleGetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid UUID", "ERR_INVALID_UUID")
		return
	}

	ex, err := h.getHandler.Handle(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Exercise not found", "ERR_NOT_FOUND")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapExerciseResponse(ex))
}

func (h *Handler) handleDeleteCustom(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid UUID", "ERR_INVALID_UUID")
		return
	}

	if err := h.deleteCustomHandler.Handle(r.Context(), userID, id); err != nil {
		if err == exercise.ErrCannotDeleteSeeded {
			httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_IMMUTABLE_SEED")
			return
		}
		httpx.WriteProblem(w, http.StatusForbidden, "Forbidden", err.Error(), "ERR_FORBIDDEN")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func mapExerciseResponse(ex *exercise.Exercise) exerciseResponse {
	var secondaries []string
	for _, s := range ex.SecondaryMuscleGroups() {
		secondaries = append(secondaries, s.String())
	}

	var creatorStr *string
	if ex.CreatedByUserID() != nil {
		s := ex.CreatedByUserID().String()
		creatorStr = &s
	}

	return exerciseResponse{
		ID:                    ex.ID().String(),
		Name:                  ex.Name(),
		PrimaryMuscleGroup:    ex.PrimaryMuscleGroup().String(),
		SecondaryMuscleGroups: secondaries,
		Equipment:             ex.Equipment().String(),
		MeasurementType:       ex.MeasurementType().String(),
		IsCustom:              ex.IsCustom(),
		CreatedByUserID:       creatorStr,
	}
}
