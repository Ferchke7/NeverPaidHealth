package http

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
)

func (h *Handler) handleListPrograms(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	tab := httpx.QueryString(r, "tab", "library")
	splitType := httpx.QueryString(r, "split_type", "")
	search := httpx.QueryString(r, "search", "")
	limit := httpx.QueryInt(r, "limit", 50)
	offset := httpx.QueryInt(r, "offset", 0)

	programs, err := h.programQueries.ListPrograms(r.Context(), tab, splitType, search, userID, limit, offset)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0, len(programs))
	for _, p := range programs {
		dtos = append(dtos, mapProgramDTO(p))
	}
	httpx.WriteJSON(w, http.StatusOK, dtos)
}

func (h *Handler) handleGetProgramByID(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	p, err := h.programQueries.GetProgramByID(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "Program not found", "ERR_NOT_FOUND")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapProgramDTO(p))
}

func (h *Handler) handleCreateProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var in command.CreateProgramInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_BAD_JSON")
		return
	}

	in.UserID = userID
	p, err := h.createProgramCmd.Handle(r.Context(), in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_CREATE_PROGRAM")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapProgramDTO(p))
}

func (h *Handler) handleUpdateProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	var in command.CreateProgramInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_BAD_JSON")
		return
	}

	in.ID = &id
	in.UserID = userID
	p, err := h.createProgramCmd.Handle(r.Context(), in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPDATE_PROGRAM")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapProgramDTO(p))
}

func (h *Handler) handleDeleteProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.deleteProgramCmd.Handle(r.Context(), userID, id); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_DELETE_PROGRAM")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handlePublishProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	var req publishProgramReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := h.publishProgramCmd.Handle(r.Context(), userID, id, req.IsPublic); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_PUBLISH_PROGRAM")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleInstallProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	var req installProgramReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	up, err := h.installProgramCmd.Handle(r.Context(), command.InstallProgramInput{
		UserID:    userID,
		ProgramID: programID,
		SetActive: req.SetActive,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_INSTALL_PROGRAM")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, mapUserProgramDTO(up))
}

func (h *Handler) handleGetActiveProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	up, p, err := h.programQueries.GetActiveProgram(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}
	if up == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	res := map[string]any{
		"user_program": mapUserProgramDTO(up),
	}
	if p != nil {
		res["program"] = mapProgramDTO(p)
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleSetActiveProgram(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var req setActiveProgramReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_BAD_JSON")
		return
	}

	upID, err := uuid.Parse(req.UserProgramID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid User Program ID", "ERR_INVALID_UUID")
		return
	}

	if err := h.setActiveProgramCmd.Handle(r.Context(), userID, upID); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_SET_ACTIVE_PROGRAM")
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleListInstalledPrograms(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	ups, err := h.programQueries.ListInstalledPrograms(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	dtos := make([]any, 0, len(ups))
	for _, up := range ups {
		p, _ := h.programQueries.GetProgramByID(r.Context(), up.ProgramID())
		item := map[string]any{
			"user_program": mapUserProgramDTO(up),
		}
		if p != nil {
			item["program"] = mapProgramDTO(p)
		}
		dtos = append(dtos, item)
	}

	httpx.WriteJSON(w, http.StatusOK, dtos)
}
