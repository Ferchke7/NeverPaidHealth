package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/application/query"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

type fixedClock struct{ now time.Time }

func (f fixedClock) Now() time.Time { return f.now }

func TestHTTP_WeeklyPlan_MultiItemsReorderSwapAndCompletionTracking(t *testing.T) {
	repo := memory.NewFakeTrainingRepo()
	rRepo := httpRoutineRepo{fake: repo}
	wRepo := repo
	oRepo := httpOutboxRepo{fake: repo}
	progRepo := memory.NewFakeProgramRepo()
	userProgRepo := memory.NewFakeUserProgramRepo()
	planRepo := memory.NewFakeWeeklyPlanRepo()

	// Wednesday 2026-11-25 10:00 UTC -> Monday is 2026-11-23
	clk := fixedClock{now: time.Date(2026, 11, 25, 10, 0, 0, 0, time.UTC)}
	userID := uuid.New()

	min8, max12 := 8, 12
	ex1, _ := routine.NewRoutineExercise(uuid.New(), "Cable Crunch", 0, 4, &min8, &max12)
	rotCore, _ := routine.NewRoutine(userID, "Morning Core & Abs", "Fast 20m", []*routine.RoutineExercise{ex1}, clk.Now())
	_ = rRepo.Save(context.Background(), rotCore)

	ex2, _ := program.NewProgramExercise(uuid.New(), "Incline Bench Press", 0, 4, &min8, &max12)
	day1, _ := program.NewProgramDay(1, "Push Hypertrophy", "", []*program.ProgramExercise{ex2})
	day2, _ := program.NewProgramDay(2, "Pull Hypertrophy", "", []*program.ProgramExercise{ex2})
	prog, _ := program.NewProgram(userID, "Upper PPL", "Desc", program.SplitPPL, 6, program.LevelIntermediate, false, "Athlete", []*program.ProgramDay{day1, day2}, clk.Now())
	_ = progRepo.Save(context.Background(), prog)

	weeklySvc := application.NewWeeklyPlanService(planRepo, rRepo, progRepo, wRepo, clk)

	h := NewHandler(
		command.NewStartWorkoutHandler(wRepo, rRepo, clk),
		command.NewUpdateActiveWorkoutHandler(wRepo),
		nil,
		command.NewLogSetHandler(wRepo),
		command.NewUpdateSetHandler(wRepo),
		command.NewFinishWorkoutHandler(wRepo, oRepo, clk),
		command.NewCreateRoutineHandler(rRepo, clk),
		command.NewUpdateRoutineHandler(rRepo, clk),
		command.NewDeleteRoutineHandler(rRepo),
		command.NewDeleteWorkoutHandler(wRepo),
		command.NewCreateProgramHandler(progRepo, clk).WithUserProgramRepo(userProgRepo),
		command.NewPublishProgramHandler(progRepo, clk),
		command.NewInstallProgramHandler(progRepo, userProgRepo, clk),
		command.NewSetActiveProgramHandler(userProgRepo),
		command.NewDeleteProgramHandler(progRepo),
		query.NewTrainingQueriesHandler(wRepo, rRepo),
		query.NewProgramQueriesHandler(progRepo, userProgRepo),
		nil,
	).WithWeeklyPlanService(weeklySvc)

	router := h.Routes()

	// 1. Assign routine to Mon (1) & Thu (4) via /workouts/weekly-plan/routine-days
	setDaysBody, _ := json.Marshal(map[string]any{
		"routine_id":   rotCore.ID().String(),
		"days_of_week": []int{1, 4},
	})
	req1 := httptest.NewRequest(http.MethodPost, "/workouts/weekly-plan/routine-days", bytes.NewReader(setDaysBody))
	req1.Header.Set("X-User-Id", userID.String())
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 on routine-days, got %d: %s", rec1.Code, rec1.Body.String())
	}

	// 2. Put multiple items on Monday (Core #0 + Program Day 1 #1) and Program Day 2 on Wednesday (3)
	dayOne := 1
	dayTwo := 2
	putBody, _ := json.Marshal(map[string]any{
		"items": []map[string]any{
			{
				"day_of_week": 1,
				"order_index": 0,
				"item_type":   "routine",
				"routine_id":  rotCore.ID().String(),
			},
			{
				"day_of_week":        1,
				"order_index":        1,
				"item_type":          "program_day",
				"program_id":         prog.ID().String(),
				"program_day_number": dayOne,
			},
			{
				"day_of_week":        3,
				"order_index":        0,
				"item_type":          "program_day",
				"program_id":         prog.ID().String(),
				"program_day_number": dayTwo,
			},
		},
	})
	req2 := httptest.NewRequest(http.MethodPut, "/workouts/weekly-plan", bytes.NewReader(putBody))
	req2.Header.Set("X-User-Id", userID.String())
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 on PUT weekly-plan, got %d: %s", rec2.Code, rec2.Body.String())
	}

	var putResp struct {
		WeekStart string `json:"week_start"`
		Items     []struct {
			ID                  string `json:"id"`
			DayOfWeek           int    `json:"day_of_week"`
			OrderIndex          int    `json:"order_index"`
			ItemType            string `json:"item_type"`
			Title               string `json:"title"`
			Subtitle            string `json:"subtitle"`
			IsCompletedThisWeek bool   `json:"is_completed_this_week"`
		} `json:"items"`
	}
	if err := json.Unmarshal(rec2.Body.Bytes(), &putResp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if putResp.WeekStart != "2026-11-23" {
		t.Fatalf("expected week_start 2026-11-23, got %s", putResp.WeekStart)
	}
	if len(putResp.Items) != 3 {
		t.Fatalf("expected 3 scheduled items, got %d", len(putResp.Items))
	}
	if putResp.Items[0].Title != "Morning Core & Abs" || putResp.Items[1].Title != "Push Hypertrophy" {
		t.Fatalf("unexpected Monday order: %+v", putResp.Items)
	}

	// 3. Toggle manual completion on Push Hypertrophy
	pushItemID := putResp.Items[1].ID
	toggleBody, _ := json.Marshal(map[string]any{"completed": true})
	req3 := httptest.NewRequest(http.MethodPost, "/workouts/weekly-plan/"+pushItemID+"/toggle-complete", bytes.NewReader(toggleBody))
	req3.Header.Set("X-User-Id", userID.String())
	rec3 := httptest.NewRecorder()
	router.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 on toggle-complete, got %d: %s", rec3.Code, rec3.Body.String())
	}

	if err := json.Unmarshal(rec3.Body.Bytes(), &putResp); err != nil {
		t.Fatalf("unmarshal toggle failed: %v", err)
	}
	if !putResp.Items[1].IsCompletedThisWeek {
		t.Fatalf("expected Push Hypertrophy to be marked completed this week")
	}
}
