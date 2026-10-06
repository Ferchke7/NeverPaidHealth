package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/neverpaidhealth/backend/pkg/logx"
	"github.com/neverpaidhealth/backend/pkg/pgxutil"
	"github.com/neverpaidhealth/backend/services/progress/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/progress/internal/application/handler"
	"github.com/neverpaidhealth/backend/services/progress/internal/application/query"
	transport "github.com/neverpaidhealth/backend/services/progress/internal/transport/http"
)

func main() {
	logger := logx.NewLogger("progress-service")
	ctx := context.Background()

	port := getEnv("PORT", "8084")
	dbURL := getEnv("DATABASE_URL", "postgres://neverpaid:neverpaid_dev_password@localhost:5432/progress_db?sslmode=disable")

	pool, err := pgxutil.NewPool(ctx, dbURL)
	if err != nil {
		logger.Warn("Database not reachable at startup (running in disconnected mode)", "error", err)
	}

	repo := postgres.NewProgressRepository(pool)
	queries := query.NewProgressQueriesHandler(repo, repo)
	onFinishedHandler := handler.NewOnWorkoutFinishedHandler(repo, repo, repo)
	handlerRoutes := transport.NewHandler(queries, onFinishedHandler)

	natsURL := getEnv("NATS_URL", "nats://localhost:4222")
	nc, err := nats.Connect(natsURL)
	if err != nil {
		logger.Warn("NATS not reachable at startup (running without async subscriber)", "error", err)
	} else {
		logger.Info("Connected to NATS, subscribing to WORKOUT.finished")
		_, _ = nc.Subscribe("WORKOUT.finished", func(msg *nats.Msg) {
			var evt handler.WorkoutFinishedEvent
			if err := json.Unmarshal(msg.Data, &evt); err == nil {
				logger.Info("Received WORKOUT.finished event from NATS", "workout_id", evt.WorkoutID)
				_ = onFinishedHandler.Handle(context.Background(), evt)
			}
		})
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handlerRoutes.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting Progress Service", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Progress server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Progress Service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(shutdownCtx)
	if nc != nil {
		nc.Close()
	}
	if pool != nil {
		pool.Close()
	}
	logger.Info("Progress Service gracefully stopped.")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
