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
	updateCustomHandler *command.UpdateCustomExerciseHandler
	deleteCustomHandler *command.DeleteCustomExerciseHandler
	listHandler         *query.ListExercisesHandler
	getHandler          *query.GetExerciseHandler
}

func NewHandler(
	createCustom *command.CreateCustomExerciseHandler,
	updateCustom *command.UpdateCustomExerciseHandler,
	deleteCustom *command.DeleteCustomExerciseHandler,
	list *query.ListExercisesHandler,
	get *query.GetExerciseHandler,
) *Handler {
	return &Handler{
		createCustomHandler: createCustom,
		updateCustomHandler: updateCustom,
		deleteCustomHandler: deleteCustom,
		listHandler:         list,
		getHandler:          get,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	// Routes supporting both root and /exercises paths
	r.Get("/", httpx.RequireAuth(h.handleList))
	r.Get("/exercises", httpx.RequireAuth(h.handleList))
	r.Post("/", httpx.RequireAuth(h.handleCreateCustom))
	r.Post("/exercises", httpx.RequireAuth(h.handleCreateCustom))
	r.Get("/{id}", httpx.RequireAuth(h.handleGetByID))
	r.Get("/exercises/{id}", httpx.RequireAuth(h.handleGetByID))
	r.Put("/{id}", httpx.RequireAuth(h.handleUpdateCustom))
	r.Put("/exercises/{id}", httpx.RequireAuth(h.handleUpdateCustom))
	r.Delete("/{id}", httpx.RequireAuth(h.handleDeleteCustom))
	r.Delete("/exercises/{id}", httpx.RequireAuth(h.handleDeleteCustom))

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

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	muscleGroup := httpx.QueryOptionalString(r, "muscle_group")
	equipment := httpx.QueryOptionalString(r, "equipment")
	search := httpx.QueryString(r, "search", "")

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

func (h *Handler) handleCreateCustom(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[createExerciseReq](w, r)
	if !ok {
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

func (h *Handler) handleUpdateCustom(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	exerciseID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	req, ok := httpx.DecodeJSON[createExerciseReq](w, r)
	if !ok {
		return
	}

	ex, err := h.updateCustomHandler.Handle(r.Context(), command.UpdateCustomExerciseInput{
		UserID:                userID,
		ExerciseID:            exerciseID,
		Name:                  req.Name,
		PrimaryMuscleGroup:    req.PrimaryMuscleGroup,
		SecondaryMuscleGroups: req.SecondaryMuscleGroups,
		Equipment:             req.Equipment,
		MeasurementType:       req.MeasurementType,
	})
	if err != nil {
		if err == exercise.ErrCannotModifySeeded {
			httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_IMMUTABLE_SEED")
			return
		}
		if err == exercise.ErrUnauthorizedExercise {
			httpx.WriteProblem(w, http.StatusForbidden, "Forbidden", err.Error(), "ERR_FORBIDDEN")
			return
		}
		if err == exercise.ErrExerciseNotFound {
			httpx.WriteProblem(w, http.StatusNotFound, "Not Found", err.Error(), "ERR_NOT_FOUND")
			return
		}
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPDATE_EXERCISE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapExerciseResponse(ex))
}

func (h *Handler) handleGetByID(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	ex, err := h.getHandler.Handle(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Exercise not found", "ERR_NOT_FOUND")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapExerciseResponse(ex))
}

func (h *Handler) handleDeleteCustom(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
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
