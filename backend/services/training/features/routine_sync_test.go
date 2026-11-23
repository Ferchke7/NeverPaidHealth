package features_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

type advancingClock struct {
	cur time.Time
}

func (c *advancingClock) Now() time.Time {
	c.cur = c.cur.Add(time.Minute)
	return c.cur
}

func intPtr(v int) *int       { return &v }
func strPtr(v string) *string { return &v }

func countUserRoutines(t *testing.T, repo *memory.FakeTrainingRepo, userID uuid.UUID) []*routine.Routine {
	t.Helper()
	all, err := repo.ListByUserID(context.Background(), userID)
	if err != nil {
		t.Fatalf("list routines: %v", err)
	}
	var owned []*routine.Routine
	for _, r := range all {
		if r.UserID() == userID {
			owned = append(owned, r)
		}
	}
	return owned
}

func TestRoutineSync_UpdateOwnAndForkOnceFromSystem(t *testing.T) {
	ctx := context.Background()
	clk := &advancingClock{cur: time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)}
	repo := memory.NewFakeTrainingRepo()
	rWrapper := routineAdapterWrapper{fake: repo}
	userID := uuid.New()

	sysEx, _ := routine.NewRoutineExercise(uuid.New(), "EZ Bar Tricep Extension", 0, 3, intPtr(10), intPtr(10))
	sysRoutine, err := routine.NewRoutine(
		uuid.Nil,
		"Jeff Nippard PPL: Push 1 (Chest Focus)",
		"Chest emphasis with secondary shoulder and triceps hypertrophy.",
		[]*routine.RoutineExercise{sysEx},
		clk.Now(),
	)
	if err != nil {
		t.Fatalf("create system routine: %v", err)
	}
	_ = repo.SaveRoutine(ctx, sysRoutine)

	createCmd := command.NewCreateRoutineHandler(rWrapper, clk)
	updateCmd := command.NewUpdateRoutineHandler(rWrapper, clk)

	// 1. First edit starting from system routine ID creates ONE personal copy and preserves notes
	exCloseGrip := uuid.New()
	fork1, err := updateCmd.Handle(ctx, command.UpdateRoutineInput{
		UserID:    userID,
		RoutineID: sysRoutine.ID(),
		Name:      "Jeff Nippard PPL: Push 1 (Chest Focus)",
		Exercises: []command.RoutineExerciseInput{
			{ExerciseID: exCloseGrip, ExerciseName: "Close-Grip Dumbbell Press", TargetSets: 3, TargetReps: intPtr(10)},
		},
	})
	if err != nil {
		t.Fatalf("first update against system routine failed: %v", err)
	}
	if fork1.ID() == sysRoutine.ID() || fork1.UserID() != userID {
		t.Fatalf("expected personal fork owned by user, got id=%s user=%s", fork1.ID(), fork1.UserID())
	}
	if fork1.Notes() != sysRoutine.Notes() {
		t.Errorf("expected notes preserved on fork, got %q", fork1.Notes())
	}

	// 2. Subsequent edit hitting EITHER the stale system ID OR the personal copy ID updates the SAME personal copy
	exPronated := uuid.New()
	fork2, err := updateCmd.Handle(ctx, command.UpdateRoutineInput{
		UserID:    userID,
		RoutineID: sysRoutine.ID(),
		Name:      "Jeff Nippard PPL: Push 1 (Chest Focus)",
		Exercises: []command.RoutineExerciseInput{
			{ExerciseID: exPronated, ExerciseName: "Dumbbell Tricep Extension - Pronated Grip", TargetSets: 3, TargetRepsMin: intPtr(8), TargetRepsMax: intPtr(12)},
		},
	})
	if err != nil {
		t.Fatalf("second update against system ID failed: %v", err)
	}
	if fork2.ID() != fork1.ID() {
		t.Errorf("expected same personal fork ID %s, got %s", fork1.ID(), fork2.ID())
	}

	// 3. Legacy POST /routines with client ID also updates the SAME personal copy instead of duplicating
	forkedID := fork1.ID()
	exLying := uuid.New()
	fork3, err := createCmd.Handle(ctx, command.CreateRoutineInput{
		ID:     &forkedID,
		UserID: userID,
		Name:   "Jeff Nippard PPL: Push 1 (Chest Focus)",
		Exercises: []command.RoutineExerciseInput{
			{ExerciseID: exLying, ExerciseName: "Lying Dumbbell Tricep Extension", TargetSets: 4, TargetRepsMin: intPtr(10), TargetRepsMax: intPtr(12)},
		},
	})
	if err != nil {
		t.Fatalf("legacy POST with id failed: %v", err)
	}
	if fork3.ID() != fork1.ID() {
		t.Errorf("expected legacy upsert to reuse ID %s, got %s", fork1.ID(), fork3.ID())
	}

	owned := countUserRoutines(t, repo, userID)
	if len(owned) != 1 {
		t.Fatalf("expected exactly 1 personal routine, got %d", len(owned))
	}
	if owned[0].Exercises()[0].ExerciseName() != "Lying Dumbbell Tricep Extension" {
		t.Errorf("expected latest exercise preserved, got %s", owned[0].Exercises()[0].ExerciseName())
	}
	if owned[0].Notes() != sysRoutine.Notes() {
		t.Errorf("expected notes preserved when omitted, got %q", owned[0].Notes())
	}

	// 4. Explicit Clone (POST without ID and "(Копия)" suffix) stays a separate user copy
	copyRot, err := createCmd.Handle(ctx, command.CreateRoutineInput{
		UserID:   userID,
		Name:     "Jeff Nippard PPL: Push 1 (Chest Focus) (Копия)",
		NotesPtr: strPtr("Custom note"),
		Exercises: []command.RoutineExerciseInput{
			{ExerciseID: exLying, ExerciseName: "Lying Dumbbell Tricep Extension", TargetSets: 4, TargetRepsMin: intPtr(10), TargetRepsMax: intPtr(12)},
		},
	})
	if err != nil {
		t.Fatalf("explicit copy failed: %v", err)
	}
	if copyRot.ID() == fork1.ID() {
		t.Errorf("expected explicit copy to have distinct ID")
	}
	if ownedAfterCopy := countUserRoutines(t, repo, userID); len(ownedAfterCopy) != 2 {
		t.Errorf("expected 2 routines after explicit copy, got %d", len(ownedAfterCopy))
	}
}

func TestRoutineSync_RejectsEditingAnotherUsersRoutine(t *testing.T) {
	ctx := context.Background()
	clk := &advancingClock{cur: time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)}
	repo := memory.NewFakeTrainingRepo()
	rWrapper := routineAdapterWrapper{fake: repo}

	ownerID := uuid.New()
	otherUserID := uuid.New()
	ex, _ := routine.NewRoutineExercise(uuid.New(), "Bench Press", 0, 3, nil, nil)
	privateRoutine, _ := routine.NewRoutine(ownerID, "Owner Routine", "", []*routine.RoutineExercise{ex}, clk.Now())
	_ = repo.SaveRoutine(ctx, privateRoutine)

	updateCmd := command.NewUpdateRoutineHandler(rWrapper, clk)
	_, err := updateCmd.Handle(ctx, command.UpdateRoutineInput{
		UserID:    otherUserID,
		RoutineID: privateRoutine.ID(),
		Name:      "Hijacked",
		Exercises: []command.RoutineExerciseInput{
			{ExerciseID: uuid.New(), ExerciseName: "Squat", TargetSets: 3},
		},
	})
	if !errors.Is(err, routine.ErrUnauthorizedRoutineEdit) {
		t.Fatalf("expected ErrUnauthorizedRoutineEdit, got %v", err)
	}
}

func TestProgramSync_ReusesSinglePersonalFork(t *testing.T) {
	ctx := context.Background()
	clk := &advancingClock{cur: time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)}
	progRepo := memory.NewFakeProgramRepo()
	userProgRepo := memory.NewFakeUserProgramRepo()
	userID := uuid.New()

	dayEx, _ := program.NewProgramExercise(uuid.New(), "Barbell Bench Press", 0, 4, intPtr(6), intPtr(8))
	day, _ := program.NewProgramDay(1, "Push 1", "", []*program.ProgramExercise{dayEx})
	sysProg, _ := program.NewProgram(uuid.Nil, "Jeff Nippard PPL", "Desc", program.SplitPPL, 6, program.LevelIntermediate, true, "Jeff Nippard", []*program.ProgramDay{day}, clk.Now())
	_ = progRepo.Save(ctx, sysProg)

	installCmd := command.NewInstallProgramHandler(progRepo, userProgRepo, clk)
	if _, err := installCmd.Handle(ctx, command.InstallProgramInput{UserID: userID, ProgramID: sysProg.ID(), SetActive: true}); err != nil {
		t.Fatalf("install failed: %v", err)
	}

	saveCmd := command.NewCreateProgramHandler(progRepo, clk).WithUserProgramRepo(userProgRepo)
	sysID := sysProg.ID()
	input := command.CreateProgramInput{
		ID:          &sysID,
		UserID:      userID,
		Name:        "Jeff Nippard PPL",
		Description: "Desc",
		SplitType:   "ppl",
		DaysPerWeek: 6,
		Level:       "intermediate",
		Days: []command.ProgramDayInput{
			{
				DayNumber: 1,
				Name:      "Push 1",
				Exercises: []command.ProgramExerciseInput{
					{ExerciseID: uuid.New(), ExerciseName: "Close-Grip Dumbbell Press", OrderIndex: 0, TargetSets: 3, TargetRepsMin: intPtr(8), TargetRepsMax: intPtr(12)},
				},
			},
		},
	}

	p1, err := saveCmd.Handle(ctx, input)
	if err != nil {
		t.Fatalf("first fork failed: %v", err)
	}
	// Second concurrent/stale edit still referencing sysID must reuse p1 instead of creating another fork
	input.Days[0].Exercises[0].ExerciseName = "EZ Bar Tricep Extension"
	p2, err := saveCmd.Handle(ctx, input)
	if err != nil {
		t.Fatalf("second fork reuse failed: %v", err)
	}
	if p1.ID() != p2.ID() {
		t.Errorf("expected same personal program ID %s, got %s", p1.ID(), p2.ID())
	}

	userProgs, _ := progRepo.ListByUserID(ctx, userID)
	if len(userProgs) != 1 {
		t.Fatalf("expected 1 user program, got %d", len(userProgs))
	}
}
