package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/neverpaidhealth/backend/pkg/jwtauth"
	"github.com/neverpaidhealth/backend/pkg/logx"
	"github.com/neverpaidhealth/backend/pkg/pgxutil"
	"github.com/neverpaidhealth/backend/services/identity/internal/adapters/google"
	"github.com/neverpaidhealth/backend/services/identity/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"github.com/neverpaidhealth/backend/services/identity/internal/application/command"
	"github.com/neverpaidhealth/backend/services/identity/internal/application/query"
	transport "github.com/neverpaidhealth/backend/services/identity/internal/transport/http"
)

func main() {
	logger := logx.NewLogger("identity-service")
	ctx := context.Background()

	port := getEnv("PORT", "8081")
	dbURL := getEnv("DATABASE_URL", "postgres://neverpaid:neverpaid_dev_password@localhost:5432/identity_db?sslmode=disable")
	googleClientID := getEnv("GOOGLE_CLIENT_ID", "mock-google-client-id")
	devMode := getEnv("AUTH_DEV_MODE", "true") == "true"

	pool, err := pgxutil.NewPool(ctx, dbURL)
	if err != nil {
		logger.Warn("Database not reachable at startup (running in disconnected mode)", "error", err)
	}

	priv, pub, err := jwtauth.GenerateDevKeypair()
	if err != nil {
		logger.Error("Failed to initialize token keys", "error", err)
		os.Exit(1)
	}
	tokenSvc := jwtauth.NewTokenService(priv, pub)

	userRepo := postgres.NewUserRepository(pool)
	googleVerifier := google.NewTokenVerifier(googleClientID)
	clock := application.RealClock{}

	authGoogleCmd := command.NewAuthenticateGoogleHandler(googleVerifier, userRepo, tokenSvc, clock)
	devLoginCmd := command.NewDevLoginHandler(userRepo, tokenSvc, clock, devMode)
	updateUnitCmd := command.NewUpdateUnitPreferenceHandler(userRepo, clock)
	getProfileQuery := query.NewGetProfileHandler(userRepo)

	handler := transport.NewHandler(authGoogleCmd, devLoginCmd, updateUnitCmd, getProfileQuery)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting Identity Service", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Identity server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Identity Service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(shutdownCtx)
	if pool != nil {
		pool.Close()
	}
	logger.Info("Identity Service gracefully stopped.")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
