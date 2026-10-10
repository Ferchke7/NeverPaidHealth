package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/logx"
	"github.com/neverpaidhealth/backend/pkg/natsx"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/pkg/pgxutil"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/application/query"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
	transport "github.com/neverpaidhealth/backend/services/training/internal/transport/http"
)

type routineAdapter struct{ repo *postgres.TrainingRepository }

func (a routineAdapter) GetByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error) {
	return a.repo.GetByID(ctx, id)
}
func (a routineAdapter) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	return a.repo.ListByUserID(ctx, userID)
}
func (a routineAdapter) Save(ctx context.Context, r *routine.Routine) error {
	return a.repo.Save(ctx, r)
}
func (a routineAdapter) Delete(ctx context.Context, id uuid.UUID) error {
	return a.repo.Delete(ctx, id)
}

type workoutAdapter struct{ repo *postgres.TrainingRepository }

func (a workoutAdapter) GetByID(ctx context.Context, id uuid.UUID) (*workout.Workout, error) {
	return a.repo.GetWorkoutByID(ctx, id)
}
func (a workoutAdapter) GetActive(ctx context.Context, userID uuid.UUID) (*workout.Workout, error) {
	return a.repo.GetActiveWorkout(ctx, userID)
}
func (a workoutAdapter) List(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*workout.Workout, error) {
	return a.repo.ListWorkouts(ctx, userID, limit, offset)
}
func (a workoutAdapter) Save(ctx context.Context, w *workout.Workout) error {
	return a.repo.SaveWorkout(ctx, w)
}
func (a workoutAdapter) Delete(ctx context.Context, id uuid.UUID) error {
	return a.repo.DeleteWorkout(ctx, id)
}

type outboxAdapter struct {
	repo       *postgres.TrainingRepository
	natsClient *natsx.JetStreamClient
}

func (a outboxAdapter) Save(ctx context.Context, msg outbox.Message) error {
	if a.natsClient != nil {
		_ = a.natsClient.Publish(msg.Subject, msg.Payload)
	}
	return a.repo.SaveOutbox(ctx, msg)
}

type dummyCatalogACL struct{}

func (dummyCatalogACL) GetExercise(ctx context.Context, id uuid.UUID) (*application.ExerciseCatalogRef, error) {
	return &application.ExerciseCatalogRef{
		ID:              id,
		Name:            "Exercise",
		MeasurementType: "weight_reps",
	}, nil
}

func main() {
	logger := logx.NewLogger("training-service")
	ctx := context.Background()

	port := getEnv("PORT", "8083")
	dbURL := getEnv("DATABASE_URL", "postgres://neverpaid:neverpaid_dev_password@localhost:5432/training_db?sslmode=disable")
	natsURL := getEnv("NATS_URL", "nats://localhost:4222")

	pool, err := pgxutil.NewPool(ctx, dbURL)
	if err != nil {
		logger.Warn("Database not reachable at startup (running in disconnected mode)", "error", err)
	}

	natsClient, err := natsx.Connect(natsURL)
	if err != nil {
		logger.Warn("NATS not reachable at startup (running without async publisher)", "error", err)
	} else {
		logger.Info("Connected to NATS JetStream")
		_ = natsClient.EnsureStream("WORKOUTS", []string{"WORKOUT.*"})
	}

	repo := postgres.NewTrainingRepository(pool)
	progRepo := postgres.NewProgramRepository(pool)
	userProgRepo := postgres.NewUserProgramRepository(pool)

	wRepo := workoutAdapter{repo: repo}
	rRepo := routineAdapter{repo: repo}
	oRepo := outboxAdapter{repo: repo, natsClient: natsClient}
	clock := application.RealClock{}
	catalogACL := dummyCatalogACL{}

	startWorkoutCmd := command.NewStartWorkoutHandler(wRepo, rRepo, clock)
	addExCmd := command.NewAddExerciseHandler(wRepo, catalogACL)
	logSetCmd := command.NewLogSetHandler(wRepo)
	updateSetCmd := command.NewUpdateSetHandler(wRepo)
	finishCmd := command.NewFinishWorkoutHandler(wRepo, oRepo, clock)
	createRotCmd := command.NewCreateRoutineHandler(rRepo, clock)
	deleteRotCmd := command.NewDeleteRoutineHandler(rRepo)
	deleteWorkoutCmd := command.NewDeleteWorkoutHandler(wRepo)

	createProgCmd := command.NewCreateProgramHandler(progRepo, clock)
	publishProgCmd := command.NewPublishProgramHandler(progRepo, clock)
	installProgCmd := command.NewInstallProgramHandler(progRepo, userProgRepo, clock)
	setActiveProgCmd := command.NewSetActiveProgramHandler(userProgRepo)
	deleteProgCmd := command.NewDeleteProgramHandler(progRepo)

	queries := query.NewTrainingQueriesHandler(wRepo, rRepo)
	progQueries := query.NewProgramQueriesHandler(progRepo, userProgRepo)

	handler := transport.NewHandler(
		startWorkoutCmd,
		addExCmd,
		logSetCmd,
		updateSetCmd,
		finishCmd,
		createRotCmd,
		deleteRotCmd,
		deleteWorkoutCmd,
		createProgCmd,
		publishProgCmd,
		installProgCmd,
		setActiveProgCmd,
		deleteProgCmd,
		queries,
		progQueries,
	)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting Training Service", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Training server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Training Service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(shutdownCtx)
	if pool != nil {
		pool.Close()
	}
	logger.Info("Training Service gracefully stopped.")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
