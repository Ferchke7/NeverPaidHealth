package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/postgres"
)

type saveReviewReq struct {
	Rating     int    `json:"rating"`
	Comment    string `json:"comment"`
	AuthorName string `json:"author_name,omitempty"`
}

type createFeedbackReq struct {
	Category   string `json:"category"`
	Title      string `json:"title"`
	Message    string `json:"message"`
	AuthorName string `json:"author_name,omitempty"`
}

type createCommentReq struct {
	Content    string  `json:"content"`
	ParentID   *string `json:"parent_id,omitempty"`
	AuthorName string  `json:"author_name,omitempty"`
}

// -------------------------------------------------------------
// Program Reviews Handlers
// -------------------------------------------------------------

func (h *Handler) handleListProgramReviews(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	reviews, err := h.communityRepo.ListProgramReviews(r.Context(), programID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, reviews)
}

func (h *Handler) handleSaveProgramReview(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	var req saveReviewReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_BAD_JSON")
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Rating must be between 1 and 5", "ERR_INVALID_RATING")
		return
	}
	if strings.TrimSpace(req.Comment) == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Comment cannot be empty", "ERR_EMPTY_COMMENT")
		return
	}

	author := strings.TrimSpace(req.AuthorName)
	if author == "" {
		author = "Атлет"
	}

	rev, err := h.communityRepo.UpsertProgramReview(r.Context(), postgres.ProgramReview{
		ProgramID:  programID,
		UserID:     userID,
		AuthorName: author,
		Rating:     req.Rating,
		Comment:    strings.TrimSpace(req.Comment),
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, rev)
}

func (h *Handler) handleDeleteProgramReview(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}
	reviewID, ok := httpx.PathUUID(w, r, "reviewId")
	if !ok {
		return
	}

	if err := h.communityRepo.DeleteProgramReview(r.Context(), programID, reviewID, userID); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_DELETE_REVIEW")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// -------------------------------------------------------------
// Feedback & Bug Reports Handlers
// -------------------------------------------------------------

func (h *Handler) handleListFeedback(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	reports, err := h.communityRepo.ListFeedback(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, reports)
}

func (h *Handler) handleCreateFeedback(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var req createFeedbackReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_BAD_JSON")
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Title cannot be empty", "ERR_EMPTY_TITLE")
		return
	}
	if strings.TrimSpace(req.Message) == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Message cannot be empty", "ERR_EMPTY_MESSAGE")
		return
	}

	author := strings.TrimSpace(req.AuthorName)
	if author == "" {
		author = "Атлет"
	}

	cat := strings.ToLower(strings.TrimSpace(req.Category))
	if cat != "bug" && cat != "feature" && cat != "ux" && cat != "other" {
		cat = "bug"
	}

	report, err := h.communityRepo.CreateFeedback(r.Context(), postgres.FeedbackReport{
		UserID:     userID,
		AuthorName: author,
		Category:   cat,
		Title:      strings.TrimSpace(req.Title),
		Message:    strings.TrimSpace(req.Message),
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, report)
}

func (h *Handler) handleToggleFeedbackUpvote(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	hasUpvoted, upvotes, err := h.communityRepo.ToggleFeedbackUpvote(r.Context(), id, userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPVOTE_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"has_upvoted": hasUpvoted,
		"upvotes":     upvotes,
	})
}

func (h *Handler) handleDeleteFeedback(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	id, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	if err := h.communityRepo.DeleteFeedback(r.Context(), id, userID); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_DELETE_FEEDBACK")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// -------------------------------------------------------------
// Real Platform Statistics Handler
// -------------------------------------------------------------

func (h *Handler) handleGetPlatformStats(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	stats, err := h.communityRepo.GetPlatformStats(r.Context())
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, stats)
}

// -------------------------------------------------------------
// Program Discussion Comments Handlers (Habr-style nested threads)
// -------------------------------------------------------------

func (h *Handler) handleListProgramComments(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	comments, err := h.communityRepo.ListProgramComments(r.Context(), programID, userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, comments)
}

func (h *Handler) handleCreateProgramComment(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	var req createCommentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON payload", "ERR_BAD_JSON")
		return
	}

	trimmedContent := strings.TrimSpace(req.Content)
	if trimmedContent == "" {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Comment content cannot be empty", "ERR_EMPTY_CONTENT")
		return
	}

	var parentUUID *uuid.UUID
	if req.ParentID != nil && strings.TrimSpace(*req.ParentID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ParentID))
		if err == nil && parsed != uuid.Nil {
			parentUUID = &parsed
		}
	}

	author := strings.TrimSpace(req.AuthorName)
	if author == "" {
		author = "Атлет"
	}

	comment, err := h.communityRepo.CreateProgramComment(r.Context(), postgres.ProgramComment{
		ProgramID:  programID,
		UserID:     userID,
		AuthorName: author,
		ParentID:   parentUUID,
		Content:    trimmedContent,
	})
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Server Error", err.Error(), "ERR_INTERNAL")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, comment)
}

func (h *Handler) handleToggleCommentUpvote(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	commentID, ok := httpx.PathUUID(w, r, "commentId")
	if !ok {
		return
	}

	upvotes, hasUpvoted, err := h.communityRepo.ToggleCommentUpvote(r.Context(), commentID, userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_UPVOTE")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"upvotes":     upvotes,
		"has_upvoted": hasUpvoted,
	})
}

func (h *Handler) handleDeleteProgramComment(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	commentID, ok := httpx.PathUUID(w, r, "commentId")
	if !ok {
		return
	}

	if err := h.communityRepo.DeleteProgramComment(r.Context(), commentID, userID); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_DELETE")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// -------------------------------------------------------------
// Program Like Handlers (Instagram-style hearts)
// -------------------------------------------------------------

func (h *Handler) handleToggleProgramLike(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	likesCount, hasLiked, err := h.communityRepo.ToggleProgramLike(r.Context(), programID, userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_TOGGLE_LIKE")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"likes_count": likesCount,
		"has_liked":   hasLiked,
	})
}

func (h *Handler) handleGetProgramLikeStatus(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	programID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	hasLiked := h.communityRepo.HasUserLikedProgram(r.Context(), programID, userID)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"has_liked": hasLiked,
	})
}
