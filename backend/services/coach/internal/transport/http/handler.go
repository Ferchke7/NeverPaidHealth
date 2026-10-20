package http

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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

	// Coach & Insights
	r.Get("/insights", httpx.RequireAuth(h.handleGetInsights))
	r.Get("/coach/insights", httpx.RequireAuth(h.handleGetInsights))
	r.Post("/chat", httpx.RequireAuth(h.handleChat))
	r.Post("/coach/chat", httpx.RequireAuth(h.handleChat))
	r.Get("/messages", httpx.RequireAuth(h.handleGetChatMessages))
	r.Get("/coach/messages", httpx.RequireAuth(h.handleGetChatMessages))
	r.Delete("/messages", httpx.RequireAuth(h.handleClearChatMessages))
	r.Delete("/coach/messages", httpx.RequireAuth(h.handleClearChatMessages))

	// Nutrition & AI Analysis (Photo + Text)
	r.Post("/nutrition/analyze-photo", httpx.RequireAuth(h.handleAnalyzePhoto))
	r.Post("/coach/nutrition/analyze-photo", httpx.RequireAuth(h.handleAnalyzePhoto))
	r.Post("/nutrition/estimate-text", httpx.RequireAuth(h.handleEstimateText))
	r.Post("/coach/nutrition/estimate-text", httpx.RequireAuth(h.handleEstimateText))

	// Meal Logs
	r.Get("/nutrition/today", httpx.RequireAuth(h.handleGetTodayNutrition))
	r.Get("/coach/nutrition/today", httpx.RequireAuth(h.handleGetTodayNutrition))
	r.Post("/nutrition/meals", httpx.RequireAuth(h.handleSaveMeal))
	r.Post("/coach/nutrition/meals", httpx.RequireAuth(h.handleSaveMeal))
	r.Delete("/nutrition/meals/{id}", httpx.RequireAuth(h.handleDeleteMeal))
	r.Delete("/coach/nutrition/meals/{id}", httpx.RequireAuth(h.handleDeleteMeal))

	return r
}

func (h *Handler) handleGetInsights(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	insights, err := h.coachService.GetInsights(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, insights)
}

func (h *Handler) handleChat(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[coach.ChatRequest](w, r)
	if !ok {
		return
	}

	lang := extractLanguage(r)

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

	res, err := h.coachService.Chat(r.Context(), userID, userName, req, lang)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_CHAT_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleGetChatMessages(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	messages, err := h.coachService.GetChatMessages(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, messages)
}

func (h *Handler) handleClearChatMessages(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	if err := h.coachService.ClearChatMessages(r.Context(), userID); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func extractLanguage(r *http.Request) string {
	if l := r.URL.Query().Get("lang"); l != "" {
		return strings.ToLower(l)
	}
	if al := r.Header.Get("Accept-Language"); al != "" {
		al = strings.ToLower(al)
		if strings.Contains(al, "uz") {
			return "uz"
		}
		if strings.Contains(al, "en") {
			return "en"
		}
		if strings.Contains(al, "ru") {
			return "ru"
		}
	}
	return "ru"
}
