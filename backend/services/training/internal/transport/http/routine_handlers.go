package http

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

func (h *Handler) handleListRoutines(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	routines, err := h.queries.ListRoutines(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0, len(routines))
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

	if err := h.deleteRoutineCmd.Handle(r.Context(), userID, id); err != nil {
		if errors.Is(err, routine.ErrRoutineNotFound) {
			httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Routine not found", "ERR_NOT_FOUND")
			return
		}
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_DELETE_ROUTINE")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
