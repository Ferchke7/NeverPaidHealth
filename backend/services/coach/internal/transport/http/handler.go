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

type analyzePhotoReq struct {
	ImageBase64 string `json:"image_base64"`
	MimeType    string `json:"mime_type,omitempty"`
	Notes       string `json:"notes,omitempty"`
	Language    string `json:"language,omitempty"`
}

func (h *Handler) handleAnalyzePhoto(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[analyzePhotoReq](w, r)
	if !ok {
		return
	}

	if req.ImageBase64 == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "image_base64 is required", "ERR_EMPTY_IMAGE")
		return
	}

	lang := req.Language
	if lang == "" {
		lang = extractLanguage(r)
	}

	analysis, err := h.coachService.AnalyzeMealPhoto(r.Context(), req.ImageBase64, req.MimeType, req.Notes, lang)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Vision Analysis Failed", err.Error(), "ERR_VISION_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, analysis)
}

type estimateTextReq struct {
	Description string `json:"description"`
	Language    string `json:"language,omitempty"`
}

func (h *Handler) handleEstimateText(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[estimateTextReq](w, r)
	if !ok {
		return
	}

	if strings.TrimSpace(req.Description) == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "description is required", "ERR_EMPTY_DESCRIPTION")
		return
	}

	lang := req.Language
	if lang == "" {
		lang = extractLanguage(r)
	}

	analysis, err := h.coachService.AnalyzeMealText(r.Context(), req.Description, lang)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Nutrition Estimation Failed", err.Error(), "ERR_ESTIMATE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, analysis)
}

func (h *Handler) handleGetTodayNutrition(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	summary, err := h.coachService.GetTodayNutrition(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, summary)
}

type saveMealReq struct {
	ID       *uuid.UUID       `json:"id,omitempty"`
	MealType string           `json:"meal_type"`
	Name     string           `json:"name"`
	Calories int              `json:"calories"`
	ProteinG float64          `json:"protein_g"`
	CarbsG   float64          `json:"carbs_g"`
	FatG     float64          `json:"fat_g"`
	PhotoURL string           `json:"photo_url,omitempty"`
	Items    []coach.MealItem `json:"items,omitempty"`
}

func (h *Handler) handleSaveMeal(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	req, ok := httpx.DecodeJSON[saveMealReq](w, r)
	if !ok {
		return
	}

	if req.Name == "" {
		req.Name = "Meal"
	}
	if req.MealType == "" {
		req.MealType = "lunch"
	}

	mealID := uuid.New()
	if req.ID != nil && *req.ID != uuid.Nil {
		mealID = *req.ID
	}

	meal := coach.MealLog{
		ID:       mealID,
		UserID:   userID,
		MealType: req.MealType,
		Name:     req.Name,
		Calories: req.Calories,
		ProteinG: req.ProteinG,
		CarbsG:   req.CarbsG,
		FatG:     req.FatG,
		PhotoURL: req.PhotoURL,
		Items:    req.Items,
	}

	if err := h.coachService.SaveMeal(r.Context(), meal); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_SAVE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, meal)
}

func (h *Handler) handleDeleteMeal(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	mealID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.coachService.DeleteMeal(r.Context(), userID, mealID); err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_DELETE_FAILED")
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
