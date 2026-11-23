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
