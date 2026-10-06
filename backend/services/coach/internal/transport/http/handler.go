package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/coach/internal/application"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type Handler struct {
	coachService *application.CoachService
}

func NewHandler(coachService *application.CoachService) *Handler {
	return &Handler{coachService: coachService}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	r.Get("/insights", h.handleGetInsights)
	r.Get("/coach/insights", h.handleGetInsights)
	r.Post("/chat", h.handleChat)
	r.Post("/coach/chat", h.handleChat)

	return r
}

func (h *Handler) handleGetInsights(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	insights, err := h.coachService.GetInsights(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, insights)
}

func (h *Handler) handleChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var req coach.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	userName := r.Header.Get("X-User-Name")
	if userName == "" {
		userName = r.Header.Get("X-User-Email")
		if idx := strings.Index(userName, "@"); idx > 0 {
			userName = userName[:idx]
		}
	}
	if userName == "" {
		userName = "Athlete"
	} else {
		userName = strings.Title(strings.ReplaceAll(userName, "_", " "))
	}

	res, err := h.coachService.Chat(r.Context(), userID, userName, req)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_CHAT_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}
