package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/pkg/logx"
	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/ai"
	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/data"
	"github.com/neverpaidhealth/backend/services/coach/internal/application"
	transport "github.com/neverpaidhealth/backend/services/coach/internal/transport/http"
)

func main() {
	logger := logx.NewLogger("coach-service")
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8086"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://neverpaid:neverpaid_dev_password@localhost:5432/training_db?sslmode=disable"
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Connect to Postgres training_db
	var pool *pgxpool.Pool
	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		slog.Warn("Failed to parse DB config, running in disconnected mode", "error", err)
	} else {
		poolConfig.MaxConns = 10
		poolConfig.MinConns = 2
		poolConfig.MaxConnLifetime = time.Hour
		pool, err = pgxpool.NewWithConfig(ctx, poolConfig)
		if err != nil {
			slog.Warn("Database not reachable at startup", "error", err)
		} else {
			if err := pool.Ping(ctx); err != nil {
				slog.Warn("Database ping failed, running in disconnected mode", "error", err)
			}
		}
	}

	progressURL := os.Getenv("PROGRESS_DATABASE_URL")
	if progressURL == "" {
		progressURL = strings.Replace(dbURL, "/training_db", "/progress_db", 1)
	}

	bodyURL := os.Getenv("BODY_DATABASE_URL")
	if bodyURL == "" {
		bodyURL = strings.Replace(dbURL, "/training_db", "/body_db", 1)
	}

	var progressPool *pgxpool.Pool
	if pConfig, err := pgxpool.ParseConfig(progressURL); err == nil {
		pConfig.MaxConns = 5
		pConfig.MinConns = 1
		pConfig.MaxConnLifetime = time.Hour
		if p, err := pgxpool.NewWithConfig(ctx, pConfig); err == nil {
			progressPool = p
			slog.Info("Connected to progress_db for PR telemetry")
		}
	}

	var bodyPool *pgxpool.Pool
	if bConfig, err := pgxpool.ParseConfig(bodyURL); err == nil {
		bConfig.MaxConns = 5
		bConfig.MinConns = 1
		bConfig.MaxConnLifetime = time.Hour
		if b, err := pgxpool.NewWithConfig(ctx, bConfig); err == nil {
			bodyPool = b
			slog.Info("Connected to body_db for measurement telemetry")
		}
	}

	telemetryCollector := data.NewTelemetryCollector(pool, progressPool, bodyPool)
	mealRepo := data.NewMealRepository(pool)
	aiProvider := ai.NewCompositeAIProvider()
	coachService := application.NewCoachService(telemetryCollector, mealRepo, aiProvider)
	httpHandler := transport.NewHandler(coachService)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      httpHandler.Routes(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Starting AI Coach Service", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down AI Coach Service...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server shutdown failed", "error", err)
	}
	if pool != nil {
		pool.Close()
	}
	if progressPool != nil {
		progressPool.Close()
	}
	if bodyPool != nil {
		bodyPool.Close()
	}
	slog.Info("AI Coach Service gracefully stopped.")
}
