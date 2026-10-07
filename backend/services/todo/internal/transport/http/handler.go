package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/todo/internal/application"
)

type Handler struct {
	todoService *application.TodoService
}

func NewHandler(todoService *application.TodoService) *Handler {
	return &Handler{todoService: todoService}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	// Route group for /todos
	r.Route("/todos", func(tr chi.Router) {
		tr.Get("/", h.handleGetDailySchedule)
		tr.Get("/schedule", h.handleGetDailySchedule)
		tr.Post("/", h.handleCreateTodo)
		tr.Post("/focus-sessions", h.handleLogFocusSession)
		tr.Get("/activity-logs", h.handleGetActivityLogs)
		tr.Get("/stats", h.handleGetStats)
		tr.Put("/{id}", h.handleUpdateTodo)
		tr.Delete("/{id}", h.handleDeleteTodo)
		tr.Post("/{id}/toggle", h.handleToggleTodo)
		tr.Post("/{id}/log-session", h.handleLogFocusSession)
	})

	// Route group for /schedule
	r.Route("/schedule", func(sr chi.Router) {
		sr.Get("/", h.handleGetDailySchedule)
		sr.Post("/", h.handleCreateTodo)
		sr.Get("/stats", h.handleGetStats)
	})

	// Standalone endpoints
	r.Get("/activity-logs", h.handleGetActivityLogs)
	r.Get("/stats", h.handleGetStats)
	r.Post("/focus-sessions", h.handleLogFocusSession)

	// Root routes fallback
	r.Get("/", h.handleGetDailySchedule)
	r.Post("/", h.handleCreateTodo)
	r.Put("/{id}", h.handleUpdateTodo)
	r.Delete("/{id}", h.handleDeleteTodo)
	r.Post("/{id}/toggle", h.handleToggleTodo)
	r.Post("/{id}/log-session", h.handleLogFocusSession)

	return r
}

func (h *Handler) handleGetDailySchedule(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	dateStr := r.URL.Query().Get("date")
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	res, err := h.todoService.GetDailySchedule(r.Context(), userID, dateStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_SCHEDULE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleCreateTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var in application.CreateTodoInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	res, err := h.todoService.CreateTodo(r.Context(), userID, in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_CREATE_TODO")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) handleUpdateTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	todoIDStr := chi.URLParam(r, "id")
	todoID, err := uuid.Parse(todoIDStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid todo ID", "ERR_INVALID_ID")
		return
	}

	var in application.UpdateTodoInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	res, err := h.todoService.UpdateTodo(r.Context(), userID, todoID, in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPDATE_TODO")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleDeleteTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	todoIDStr := chi.URLParam(r, "id")
	todoID, err := uuid.Parse(todoIDStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid todo ID", "ERR_INVALID_ID")
		return
	}

	if err := h.todoService.DeleteTodo(r.Context(), userID, todoID); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_DELETE_TODO")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleToggleTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	todoIDStr := chi.URLParam(r, "id")
	todoID, err := uuid.Parse(todoIDStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid todo ID", "ERR_INVALID_ID")
		return
	}

	res, err := h.todoService.ToggleTodo(r.Context(), userID, todoID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_TOGGLE_TODO")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleLogFocusSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var in application.LogFocusSessionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	todoIDStr := chi.URLParam(r, "id")
	if todoIDStr != "" && in.TodoID == nil {
		if parsed, err := uuid.Parse(todoIDStr); err == nil {
			in.TodoID = &parsed
		}
	}

	res, err := h.todoService.LogFocusSession(r.Context(), userID, in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_LOG_SESSION")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) handleGetActivityLogs(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	dateStr := r.URL.Query().Get("date")
	res, err := h.todoService.GetActivityLogs(r.Context(), userID, dateStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_ACTIVITY_LOGS")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleGetStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	days := 7
	if dStr := r.URL.Query().Get("days"); dStr != "" {
		if d, err := strconv.Atoi(dStr); err == nil && d > 0 {
			days = d
		}
	}

	res, err := h.todoService.GetStats(r.Context(), userID, days)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_STATS_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}
