package http

import (
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type analyzePhotoReq struct {
	ImageBase64 string `json:"image_base64"`
	MimeType    string `json:"mime_type,omitempty"`
	Notes       string `json:"notes,omitempty"`
	Language    string `json:"language,omitempty"`
}

type estimateTextReq struct {
	Description string `json:"description"`
	Language    string `json:"language,omitempty"`
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
