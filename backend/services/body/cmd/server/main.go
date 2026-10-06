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
	"github.com/neverpaidhealth/backend/services/body/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/body/internal/application"
	"github.com/neverpaidhealth/backend/services/body/internal/application/command"
	"github.com/neverpaidhealth/backend/services/body/internal/application/query"
	transport "github.com/neverpaidhealth/backend/services/body/internal/transport/http"
)

func main() {
	logger := logx.NewLogger("body-service")
	ctx := context.Background()

	port := getEnv("PORT", "8085")
	dbURL := getEnv("DATABASE_URL", "postgres://neverpaid:neverpaid_dev_password@localhost:5432/body_db?sslmode=disable")

	pool, err := pgxutil.NewPool(ctx, dbURL)
	if err != nil {
		logger.Warn("Database not reachable at startup (running in disconnected mode)", "error", err)
	}

	repo := postgres.NewBodyRepository(pool)
	clock := application.RealClock{}

	logCmd := command.NewLogBodyMeasurementHandler(repo, clock)
	deleteCmd := command.NewDeleteBodyMeasurementHandler(repo)
	queries := query.NewBodyQueriesHandler(repo)

	handler := transport.NewHandler(logCmd, deleteCmd, queries)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting Body Service", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Body server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Body Service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(shutdownCtx)
	if pool != nil {
		pool.Close()
	}
	logger.Info("Body Service gracefully stopped.")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
