package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/pkg/logx"
	"github.com/neverpaidhealth/backend/services/todo/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/todo/internal/application"
	transport "github.com/neverpaidhealth/backend/services/todo/internal/transport/http"
)

func main() {
	logger := logx.NewLogger("todo-service")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8087"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://neverpaid:neverpaid_dev_password@localhost:5432/todo_db?sslmode=disable"
	}

	ctx := context.Background()
	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		logger.Error("Failed to parse database config", "error", err)
		os.Exit(1)
	}

	poolConfig.MaxConns = 15
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = 1 * time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		logger.Error("Failed connecting to todo database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.Warn("Database ping warning (will retry on incoming requests)", "error", err)
	}

	repo := postgres.NewTodoRepository(pool)
	todoSvc := application.NewTodoService(repo)
	handler := transport.NewHandler(todoSvc)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting Todo & Schedule microservice", "port", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Todo server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Todo service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("Forced shutdown of Todo service", "error", err)
	}
	logger.Info("Todo service gracefully stopped.")
}
