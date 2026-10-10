package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/neverpaidhealth/backend/pkg/logx"
	"github.com/neverpaidhealth/backend/pkg/pgxutil"
	"github.com/neverpaidhealth/backend/services/exercise/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/command"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/query"
	transport "github.com/neverpaidhealth/backend/services/exercise/internal/transport/http"
)

func main() {
	logger := logx.NewLogger("exercise-service")
	ctx := context.Background()

	port := getEnv("PORT", "8082")
	dbURL := getEnv("DATABASE_URL", "postgres://neverpaid:neverpaid_dev_password@localhost:5432/exercise_db?sslmode=disable")

	pool, err := pgxutil.NewPool(ctx, dbURL)
	if err != nil {
		logger.Warn("Database not reachable at startup (running in disconnected mode)", "error", err)
	}

	repo := postgres.NewExerciseRepository(pool)
	createCustomCmd := command.NewCreateCustomExerciseHandler(repo)
	updateCustomCmd := command.NewUpdateCustomExerciseHandler(repo)
	deleteCustomCmd := command.NewDeleteCustomExerciseHandler(repo)
	listQuery := query.NewListExercisesHandler(repo)
	getQuery := query.NewGetExerciseHandler(repo)

	handler := transport.NewHandler(createCustomCmd, updateCustomCmd, deleteCustomCmd, listQuery, getQuery)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting Exercise Service", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Exercise server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Exercise Service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(shutdownCtx)
	if pool != nil {
		pool.Close()
	}
	logger.Info("Exercise Service gracefully stopped.")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
