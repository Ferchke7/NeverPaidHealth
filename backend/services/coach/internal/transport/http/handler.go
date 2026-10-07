package http

import (
	"encoding/json"
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
	r.Get("/insights", h.handleGetInsights)
	r.Get("/coach/insights", h.handleGetInsights)
	r.Post("/chat", h.handleChat)
	r.Post("/coach/chat", h.handleChat)

	// Nutrition & Photo Analysis
	r.Post("/nutrition/analyze-photo", h.handleAnalyzePhoto)
	r.Post("/coach/nutrition/analyze-photo", h.handleAnalyzePhoto)
	r.Get("/nutrition/today", h.handleGetTodayNutrition)
	r.Get("/coach/nutrition/today", h.handleGetTodayNutrition)
	r.Post("/nutrition/meals", h.handleSaveMeal)
	r.Post("/coach/nutrition/meals", h.handleSaveMeal)
	r.Delete("/nutrition/meals/{id}", h.handleDeleteMeal)
	r.Delete("/coach/nutrition/meals/{id}", h.handleDeleteMeal)

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

type analyzePhotoReq struct {
	ImageBase64 string `json:"image_base64"`
	MimeType    string `json:"mime_type,omitempty"`
	Notes       string `json:"notes,omitempty"`
}

func (h *Handler) handleAnalyzePhoto(w http.ResponseWriter, r *http.Request) {
	_, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var req analyzePhotoReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	if req.ImageBase64 == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "image_base64 is required", "ERR_EMPTY_IMAGE")
		return
	}

	analysis, err := h.coachService.AnalyzeMealPhoto(r.Context(), req.ImageBase64, req.MimeType, req.Notes)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Vision Analysis Failed", err.Error(), "ERR_VISION_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, analysis)
}

func (h *Handler) handleGetTodayNutrition(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	summary, err := h.coachService.GetTodayNutrition(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, summary)
}

type saveMealReq struct {
	ID        *uuid.UUID       `json:"id,omitempty"`
	MealType  string           `json:"meal_type"`
	Name      string           `json:"name"`
	Calories  int              `json:"calories"`
	ProteinG  float64          `json:"protein_g"`
	CarbsG    float64          `json:"carbs_g"`
	FatG      float64          `json:"fat_g"`
	PhotoURL  string           `json:"photo_url,omitempty"`
	Items     []coach.MealItem `json:"items,omitempty"`
}

func (h *Handler) handleSaveMeal(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	var req saveMealReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	if req.Name == "" {
		req.Name = "Meal"
	}
	if req.MealType == "" {
		req.MealType = "meal"
	}

	mealID := uuid.New()
	if req.ID != nil && *req.ID != uuid.Nil {
		mealID = *req.ID
	}

	meal := coach.MealLog{
		ID:        mealID,
		UserID:    userID,
		MealType:  req.MealType,
		Name:      req.Name,
		Calories:  req.Calories,
		ProteinG:  req.ProteinG,
		CarbsG:    req.CarbsG,
		FatG:      req.FatG,
		PhotoURL:  req.PhotoURL,
		Items:     req.Items,
	}

	if err := h.coachService.SaveMeal(r.Context(), meal); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_SAVE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, meal)
}

func (h *Handler) handleDeleteMeal(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
		return
	}

	idStr := chi.URLParam(r, "id")
	mealID, err := uuid.Parse(idStr)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid meal id", "ERR_INVALID_ID")
		return
	}

	if err := h.coachService.DeleteMeal(r.Context(), userID, mealID); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_DELETE_FAILED")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
