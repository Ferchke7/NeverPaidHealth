package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/neverpaidhealth/backend/gateway/internal/config"
	"github.com/neverpaidhealth/backend/gateway/internal/proxy"
	"github.com/neverpaidhealth/backend/pkg/jwtauth"
	"github.com/neverpaidhealth/backend/pkg/logx"
)

func main() {
	logger := logx.NewLogger("gateway")
	cfg := config.Load()

	// In dev mode or standalone, generate or load keypair
	priv, pub, err := jwtauth.GenerateDevKeypair()
	if err != nil {
		logger.Error("Failed to initialize JWT keys", "error", err)
		os.Exit(1)
	}
	tokenService := jwtauth.NewTokenService(priv, pub)

	handler := proxy.NewRouter(cfg, tokenService)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("Starting API Gateway", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Gateway server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down API Gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Gateway forced shutdown", "error", err)
	}
	logger.Info("API Gateway gracefully stopped.")
}
