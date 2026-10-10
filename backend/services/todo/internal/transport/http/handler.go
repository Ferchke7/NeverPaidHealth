package http

import (
	"net/http"
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
		tr.Get("/", httpx.RequireAuth(h.handleGetDailySchedule))
		tr.Get("/schedule", httpx.RequireAuth(h.handleGetDailySchedule))
		tr.Post("/", httpx.RequireAuth(h.handleCreateTodo))
		tr.Post("/focus-sessions", httpx.RequireAuth(h.handleLogFocusSession))
		tr.Get("/activity-logs", httpx.RequireAuth(h.handleGetActivityLogs))
		tr.Get("/stats", httpx.RequireAuth(h.handleGetStats))
		tr.Put("/{id}", httpx.RequireAuth(h.handleUpdateTodo))
		tr.Delete("/{id}", httpx.RequireAuth(h.handleDeleteTodo))
		tr.Post("/{id}/toggle", httpx.RequireAuth(h.handleToggleTodo))
		tr.Post("/{id}/log-session", httpx.RequireAuth(h.handleLogFocusSession))
	})

	// Route group for /schedule
	r.Route("/schedule", func(sr chi.Router) {
		sr.Get("/", httpx.RequireAuth(h.handleGetDailySchedule))
		sr.Post("/", httpx.RequireAuth(h.handleCreateTodo))
		sr.Get("/stats", httpx.RequireAuth(h.handleGetStats))
	})

	// Standalone endpoints
	r.Get("/activity-logs", httpx.RequireAuth(h.handleGetActivityLogs))
	r.Get("/stats", httpx.RequireAuth(h.handleGetStats))
	r.Post("/focus-sessions", httpx.RequireAuth(h.handleLogFocusSession))

	// Root routes fallback
	r.Get("/", httpx.RequireAuth(h.handleGetDailySchedule))
	r.Post("/", httpx.RequireAuth(h.handleCreateTodo))
	r.Put("/{id}", httpx.RequireAuth(h.handleUpdateTodo))
	r.Delete("/{id}", httpx.RequireAuth(h.handleDeleteTodo))
	r.Post("/{id}/toggle", httpx.RequireAuth(h.handleToggleTodo))
	r.Post("/{id}/log-session", httpx.RequireAuth(h.handleLogFocusSession))

	return r
}

func (h *Handler) handleGetDailySchedule(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	dateStr := httpx.QueryString(r, "date", time.Now().Format("2006-01-02"))

	res, err := h.todoService.GetDailySchedule(r.Context(), userID, dateStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_SCHEDULE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleCreateTodo(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	in, ok := httpx.DecodeJSON[application.CreateTodoInput](w, r)
	if !ok {
		return
	}

	res, err := h.todoService.CreateTodo(r.Context(), userID, in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_CREATE_TODO")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) handleUpdateTodo(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	todoID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	in, ok := httpx.DecodeJSON[application.UpdateTodoInput](w, r)
	if !ok {
		return
	}

	res, err := h.todoService.UpdateTodo(r.Context(), userID, todoID, in)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPDATE_TODO")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleDeleteTodo(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	todoID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.todoService.DeleteTodo(r.Context(), userID, todoID); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_DELETE_TODO")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleToggleTodo(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	todoID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	res, err := h.todoService.ToggleTodo(r.Context(), userID, todoID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_TOGGLE_TODO")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleLogFocusSession(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	in, ok := httpx.DecodeJSON[application.LogFocusSessionInput](w, r)
	if !ok {
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

func (h *Handler) handleGetActivityLogs(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	dateStr := httpx.QueryString(r, "date", "")
	res, err := h.todoService.GetActivityLogs(r.Context(), userID, dateStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_ACTIVITY_LOGS")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleGetStats(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	days := httpx.QueryInt(r, "days", 7)
	if days <= 0 {
		days = 7
	}

	res, err := h.todoService.GetStats(r.Context(), userID, days)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_STATS_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}
