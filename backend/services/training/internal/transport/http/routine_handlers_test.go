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
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/application/query"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

type httpRoutineRepo struct{ fake *memory.FakeTrainingRepo }

func (w httpRoutineRepo) GetByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error) {
	return w.fake.GetRoutineByID(ctx, id)
}
func (w httpRoutineRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	return w.fake.ListByUserID(ctx, userID)
}
func (w httpRoutineRepo) Save(ctx context.Context, r *routine.Routine) error {
	return w.fake.SaveRoutine(ctx, r)
}
func (w httpRoutineRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return w.fake.DeleteRoutine(ctx, id)
}

type httpOutboxRepo struct{ fake *memory.FakeTrainingRepo }

func (w httpOutboxRepo) Save(ctx context.Context, m outbox.Message) error {
	return w.fake.SaveOutbox(ctx, m)
}

func TestHTTP_PutRoutine_UpdatesInPlaceAndForksSystemOnce(t *testing.T) {
	repo := memory.NewFakeTrainingRepo()
	rRepo := httpRoutineRepo{fake: repo}
	oRepo := httpOutboxRepo{fake: repo}
	progRepo := memory.NewFakeProgramRepo()
	userProgRepo := memory.NewFakeUserProgramRepo()
	clk := application.RealClock{}

	userID := uuid.New()
	sysRot, _ := routine.NewRoutine(
		uuid.Nil,
		"Jeff Nippard PPL: Push 1 (Chest Focus)",
		"Chest emphasis",
		[]*routine.RoutineExercise{
			func() *routine.RoutineExercise {
				ex, _ := routine.NewRoutineExercise(uuid.New(), "EZ Bar Tricep Extension", 0, 3, nil, nil)
				return ex
			}(),
		},
		time.Now().UTC(),
	)
	_ = repo.SaveRoutine(context.Background(), sysRot)

	h := NewHandler(
		command.NewStartWorkoutHandler(repo, rRepo, clk),
		command.NewUpdateActiveWorkoutHandler(repo),
		command.NewAddExerciseHandler(repo, repo),
		command.NewLogSetHandler(repo),
		command.NewUpdateSetHandler(repo),
		command.NewFinishWorkoutHandler(repo, oRepo, clk),
		command.NewCreateRoutineHandler(rRepo, clk),
		command.NewUpdateRoutineHandler(rRepo, clk),
		command.NewDeleteRoutineHandler(rRepo),
		command.NewDeleteWorkoutHandler(repo),
		command.NewCreateProgramHandler(progRepo, clk),
		command.NewPublishProgramHandler(progRepo, clk),
		command.NewInstallProgramHandler(progRepo, userProgRepo, clk),
		command.NewSetActiveProgramHandler(userProgRepo),
		command.NewDeleteProgramHandler(progRepo),
		query.NewTrainingQueriesHandler(repo, rRepo),
		query.NewProgramQueriesHandler(progRepo, userProgRepo),
		nil,
	)
	router := h.Routes()

	doPut := func(targetID uuid.UUID, exName string) map[string]any {
		body, _ := json.Marshal(map[string]any{
			"name": "Jeff Nippard PPL: Push 1 (Chest Focus)",
			"exercises": []map[string]any{
				{
					"exercise_id":     uuid.New().String(),
					"exercise_name":   exName,
					"target_sets":     3,
					"target_reps_min": 8,
					"target_reps_max": 12,
				},
			},
		})
		req := httptest.NewRequest(http.MethodPut, "/routines/"+targetID.String(), bytes.NewReader(body))
		req.Header.Set("X-User-Id", userID.String())
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("PUT /routines/%s returned %d: %s", targetID, rec.Code, rec.Body.String())
		}
		var out map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("unmarshal PUT response: %v", err)
		}
		return out
	}

	res1 := doPut(sysRot.ID(), "Close-Grip Dumbbell Press")
	personalID, err := uuid.Parse(res1["id"].(string))
	if err != nil {
		t.Fatalf("invalid id in response: %v", err)
	}
	if personalID == sysRot.ID() {
		t.Fatalf("expected fork from system routine, got same ID")
	}

	res2 := doPut(personalID, "Dip")
	if res2["id"].(string) != personalID.String() {
		t.Fatalf("expected update in-place to keep ID %s, got %s", personalID, res2["id"])
	}

	listReq := httptest.NewRequest(http.MethodGet, "/routines", nil)
	listReq.Header.Set("X-User-Id", userID.String())
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("GET /routines returned %d", listRec.Code)
	}
	var list []map[string]any
	_ = json.Unmarshal(listRec.Body.Bytes(), &list)

	userOwned := 0
	for _, item := range list {
		if item["user_id"] == userID.String() {
			userOwned++
		}
	}
	if userOwned != 1 {
		t.Fatalf("expected exactly 1 user routine, got %d (%v)", userOwned, list)
	}
}

func TestHTTP_StartAndUpdateActiveWorkout_ReturnsInGetActive(t *testing.T) {
	repo := memory.NewFakeTrainingRepo()
	rRepo := httpRoutineRepo{fake: repo}
	oRepo := httpOutboxRepo{fake: repo}
	progRepo := memory.NewFakeProgramRepo()
	userProgRepo := memory.NewFakeUserProgramRepo()
	clk := application.RealClock{}

	userID := uuid.New()
	exID := uuid.New()
	setID := uuid.New()
	workoutID := uuid.New()

	h := NewHandler(
		command.NewStartWorkoutHandler(repo, rRepo, clk),
		command.NewUpdateActiveWorkoutHandler(repo),
		command.NewAddExerciseHandler(repo, repo),
		command.NewLogSetHandler(repo),
		command.NewUpdateSetHandler(repo),
		command.NewFinishWorkoutHandler(repo, oRepo, clk),
		command.NewCreateRoutineHandler(rRepo, clk),
		command.NewUpdateRoutineHandler(rRepo, clk),
		command.NewDeleteRoutineHandler(rRepo),
		command.NewDeleteWorkoutHandler(repo),
		command.NewCreateProgramHandler(progRepo, clk),
		command.NewPublishProgramHandler(progRepo, clk),
		command.NewInstallProgramHandler(progRepo, userProgRepo, clk),
		command.NewSetActiveProgramHandler(userProgRepo),
		command.NewDeleteProgramHandler(progRepo),
		query.NewTrainingQueriesHandler(repo, rRepo),
		query.NewProgramQueriesHandler(progRepo, userProgRepo),
		nil,
	)
	router := h.Routes()

	startBody, _ := json.Marshal(map[string]any{
		"id":             workoutID.String(),
		"name":           "Push Day",
		"replace_active": true,
		"exercises": []map[string]any{
			{
				"exercise_id":      exID.String(),
				"exercise_name":    "Barbell Bench Press",
				"measurement_type": "weight_reps",
				"sets": []map[string]any{
					{"id": setID.String(), "set_number": 1, "set_type": "normal", "weight_kg": 80, "reps": 8, "completed": false},
				},
			},
		},
	})
	startReq := httptest.NewRequest(http.MethodPost, "/workouts", bytes.NewReader(startBody))
	startReq.Header.Set("X-User-Id", userID.String())
	startRec := httptest.NewRecorder()
	router.ServeHTTP(startRec, startReq)
	if startRec.Code != http.StatusCreated {
		t.Fatalf("POST /workouts returned %d: %s", startRec.Code, startRec.Body.String())
	}

	putBody, _ := json.Marshal(map[string]any{
		"name": "Push Day Updated",
		"exercises": []map[string]any{
			{
				"exercise_id":      exID.String(),
				"exercise_name":    "Barbell Bench Press",
				"measurement_type": "weight_reps",
				"sets": []map[string]any{
					{"id": setID.String(), "set_number": 1, "set_type": "normal", "weight_kg": 85, "reps": 10, "completed": true},
				},
			},
		},
	})
	putReq := httptest.NewRequest(http.MethodPut, "/workouts/"+workoutID.String(), bytes.NewReader(putBody))
	putReq.Header.Set("X-User-Id", userID.String())
	putRec := httptest.NewRecorder()
	router.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("PUT /workouts/{id} returned %d: %s", putRec.Code, putRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/workouts/active", nil)
	getReq.Header.Set("X-User-Id", userID.String())
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /workouts/active returned %d", getRec.Code)
	}
	var activeDTO map[string]any
	_ = json.Unmarshal(getRec.Body.Bytes(), &activeDTO)
	if activeDTO["name"] != "Push Day Updated" {
		t.Fatalf("expected updated name, got %v", activeDTO["name"])
	}
	exs := activeDTO["exercises"].([]any)
	if len(exs) != 1 {
		t.Fatalf("expected 1 exercise, got %d", len(exs))
	}
}

func TestHTTP_ReorderRoutines_PersistsCustomOrder(t *testing.T) {
	repo := memory.NewFakeTrainingRepo()
	rRepo := httpRoutineRepo{fake: repo}
	oRepo := httpOutboxRepo{fake: repo}
	progRepo := memory.NewFakeProgramRepo()
	userProgRepo := memory.NewFakeUserProgramRepo()
	clk := application.RealClock{}

	userID := uuid.New()
	makeRoutine := func(name string, offset time.Duration) *routine.Routine {
		ex, _ := routine.NewRoutineExercise(uuid.New(), "Bench Press", 0, 3, nil, nil)
		rot, _ := routine.NewRoutine(userID, name, "", []*routine.RoutineExercise{ex}, time.Now().UTC().Add(offset))
		_ = repo.SaveRoutine(context.Background(), rot)
		return rot
	}

	r1 := makeRoutine("Push Day", -3*time.Hour)
	r2 := makeRoutine("Pull Day", -2*time.Hour)
	r3 := makeRoutine("Legs Day", -1*time.Hour)

	h := NewHandler(
		command.NewStartWorkoutHandler(repo, rRepo, clk),
		command.NewUpdateActiveWorkoutHandler(repo),
		command.NewAddExerciseHandler(repo, repo),
		command.NewLogSetHandler(repo),
		command.NewUpdateSetHandler(repo),
		command.NewFinishWorkoutHandler(repo, oRepo, clk),
		command.NewCreateRoutineHandler(rRepo, clk),
		command.NewUpdateRoutineHandler(rRepo, clk),
		command.NewDeleteRoutineHandler(rRepo),
		command.NewDeleteWorkoutHandler(repo),
		command.NewCreateProgramHandler(progRepo, clk),
		command.NewPublishProgramHandler(progRepo, clk),
		command.NewInstallProgramHandler(progRepo, userProgRepo, clk),
		command.NewSetActiveProgramHandler(userProgRepo),
		command.NewDeleteProgramHandler(progRepo),
		query.NewTrainingQueriesHandler(repo, rRepo),
		query.NewProgramQueriesHandler(progRepo, userProgRepo),
		nil,
	).WithReorderRoutines(command.NewReorderRoutinesHandler(rRepo))
	router := h.Routes()

	reorderBody, _ := json.Marshal(map[string]any{
		"routine_ids": []string{r3.ID().String(), r1.ID().String(), r2.ID().String()},
	})
	req := httptest.NewRequest(http.MethodPut, "/routines/reorder", bytes.NewReader(reorderBody))
	req.Header.Set("X-User-Id", userID.String())
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT /routines/reorder returned %d: %s", rec.Code, rec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/routines", nil)
	getReq.Header.Set("X-User-Id", userID.String())
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /routines returned %d", getRec.Code)
	}
	var got []map[string]any
	_ = json.Unmarshal(getRec.Body.Bytes(), &got)
	if len(got) != 3 {
		t.Fatalf("expected 3 routines, got %d", len(got))
	}
	if got[0]["name"] != "Legs Day" || got[1]["name"] != "Push Day" || got[2]["name"] != "Pull Day" {
		t.Fatalf("unexpected custom routine order: %v, %v, %v", got[0]["name"], got[1]["name"], got[2]["name"])
	}
}
