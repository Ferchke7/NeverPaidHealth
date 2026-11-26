package http

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/weeklyplan"
)

type weeklyPlanItemReq struct {
	ID               *string `json:"id,omitempty"`
	DayOfWeek        int     `json:"day_of_week"`
	OrderIndex       int     `json:"order_index"`
	ItemType         string  `json:"item_type"`
	RoutineID        *string `json:"routine_id,omitempty"`
	ProgramID        *string `json:"program_id,omitempty"`
	ProgramDayNumber *int    `json:"program_day_number,omitempty"`
	Title            string  `json:"title,omitempty"`
	Notes            string  `json:"notes,omitempty"`
}

type saveWeeklyPlanReq struct {
	Items []weeklyPlanItemReq `json:"items"`
}

type setRoutineWeekdaysReq struct {
	RoutineID  string `json:"routine_id"`
	DaysOfWeek []int  `json:"days_of_week"`
}

type toggleWeeklyPlanCompleteReq struct {
	Completed bool `json:"completed"`
}

func mapWeeklyPlanSnapshotDTO(snap *application.WeeklyPlanSnapshot) map[string]any {
	items := make([]any, 0, len(snap.Items))
	for _, it := range snap.Items {
		exList := make([]any, 0, len(it.Exercises))
		for _, ex := range it.Exercises {
			exList = append(exList, map[string]any{
				"exercise_id":     ex.ExerciseID.String(),
				"exercise_name":   ex.ExerciseName,
				"order_index":     ex.OrderIndex,
				"target_sets":     ex.TargetSets,
				"target_reps_min": ex.TargetRepsMin,
				"target_reps_max": ex.TargetRepsMax,
			})
		}

		var routineIDStr *string
		if it.RoutineID != nil && *it.RoutineID != uuid.Nil {
			s := it.RoutineID.String()
			routineIDStr = &s
		}

		var programIDStr *string
		if it.ProgramID != nil && *it.ProgramID != uuid.Nil {
			s := it.ProgramID.String()
			programIDStr = &s
		}

		items = append(items, map[string]any{
			"id":                     it.ID.String(),
			"day_of_week":            it.DayOfWeek,
			"order_index":            it.OrderIndex,
			"item_type":              it.ItemType,
			"routine_id":             routineIDStr,
			"program_id":             programIDStr,
			"program_day_number":     it.ProgramDayNumber,
			"title":                  it.Title,
			"subtitle":               it.Subtitle,
			"notes":                  it.Notes,
			"exercises":              exList,
			"is_completed_this_week": it.IsCompletedThisWeek,
		})
	}

	return map[string]any{
		"week_start": snap.WeekStart,
		"items":      items,
	}
}

func (h *Handler) handleGetWeeklyPlan(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	if h.weeklyPlanSvc == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"week_start": weeklyplan.MondayKey(application.RealClock{}.Now()),
			"items":      []any{},
		})
		return
	}

	snap, err := h.weeklyPlanSvc.GetWeeklyPlan(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusInternalServerError, "Internal Error", err.Error(), "ERR_WEEKLY_PLAN")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, mapWeeklyPlanSnapshotDTO(snap))
}

func (h *Handler) handleSaveWeeklyPlan(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	if h.weeklyPlanSvc == nil {
		httpx.WriteProblem(w, http.StatusServiceUnavailable, "Unavailable", "Weekly plan service not configured", "ERR_UNAVAILABLE")
		return
	}

	req, ok := httpx.DecodeJSON[saveWeeklyPlanReq](w, r)
	if !ok {
		return
	}

	inputs := make([]application.WeeklyPlanItemInput, 0, len(req.Items))
	for _, item := range req.Items {
		inputs = append(inputs, application.WeeklyPlanItemInput{
			ID:               parseOptionalUUID(item.ID),
			DayOfWeek:        item.DayOfWeek,
			OrderIndex:       item.OrderIndex,
			ItemType:         item.ItemType,
			RoutineID:        parseOptionalUUID(item.RoutineID),
			ProgramID:        parseOptionalUUID(item.ProgramID),
			ProgramDayNumber: item.ProgramDayNumber,
			Title:            item.Title,
			Notes:            item.Notes,
		})
	}

	snap, err := h.weeklyPlanSvc.SaveWeeklyPlan(r.Context(), userID, inputs)
	if err != nil {
		if errors.Is(err, application.ErrInvalidDayOfWeek) {
			httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_INVALID_DAY")
			return
		}
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_SAVE_WEEKLY_PLAN")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapWeeklyPlanSnapshotDTO(snap))
}

func (h *Handler) handleSetRoutineWeekdays(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	if h.weeklyPlanSvc == nil {
		httpx.WriteProblem(w, http.StatusServiceUnavailable, "Unavailable", "Weekly plan service not configured", "ERR_UNAVAILABLE")
		return
	}

	req, ok := httpx.DecodeJSON[setRoutineWeekdaysReq](w, r)
	if !ok {
		return
	}

	routineID, err := uuid.Parse(req.RoutineID)
	if err != nil || routineID == uuid.Nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid routine_id", "ERR_INVALID_ROUTINE_ID")
		return
	}

	snap, err := h.weeklyPlanSvc.SetRoutineWeekdays(r.Context(), userID, routineID, req.DaysOfWeek)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_ROUTINE_DAYS")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapWeeklyPlanSnapshotDTO(snap))
}

func (h *Handler) handleToggleWeeklyPlanComplete(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	if h.weeklyPlanSvc == nil {
		httpx.WriteProblem(w, http.StatusServiceUnavailable, "Unavailable", "Weekly plan service not configured", "ERR_UNAVAILABLE")
		return
	}

	itemID, ok := httpx.PathUUID(w, r, "id")
	if !ok {
		return
	}

	req, ok := httpx.DecodeJSON[toggleWeeklyPlanCompleteReq](w, r)
	if !ok {
		return
	}

	snap, err := h.weeklyPlanSvc.ToggleItemCompleted(r.Context(), userID, itemID, req.Completed)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_TOGGLE_PLAN_ITEM")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapWeeklyPlanSnapshotDTO(snap))
}
