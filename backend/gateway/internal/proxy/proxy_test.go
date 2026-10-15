package proxy_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/gateway/internal/config"
	"github.com/neverpaidhealth/backend/gateway/internal/proxy"
	"github.com/neverpaidhealth/backend/pkg/jwtauth"
)

func TestGateway_StripsSpoofedUserHeaders(t *testing.T) {
	var capturedUserID string
	var capturedEmail string

	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUserID = r.Header.Get("X-User-Id")
		capturedEmail = r.Header.Get("X-User-Email")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer backendServer.Close()

	cfg := &config.Config{
		Port:        "8080",
		IdentityURL: backendServer.URL,
		ExerciseURL: backendServer.URL,
		TrainingURL: backendServer.URL,
		ProgressURL: backendServer.URL,
		BodyURL:     backendServer.URL,
		CoachURL:    backendServer.URL,
		TodoURL:     backendServer.URL,
	}

	tokenSvc, _ := jwtauth.NewTokenServiceFromEnv()
	realUserID := uuid.New()
	realEmail := "real@neverpaid.dev"
	validToken, err := tokenSvc.IssueAccessToken(realUserID, realEmail, 15*time.Minute)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	router := proxy.NewRouter(cfg, tokenSvc, slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Scenario 1: Attacker sends fake X-User-Id header with valid JWT of another user
	req := httptest.NewRequest("GET", "/api/v1/exercises", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)
	req.Header.Set("X-User-Id", "attacker-injected-id")
	req.Header.Set("X-User-Email", "attacker@spoof.dev")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if capturedUserID != realUserID.String() {
		t.Errorf("expected downstream X-User-Id to be verified JWT user %s, got spoofed %s", realUserID, capturedUserID)
	}
	if capturedEmail != realEmail {
		t.Errorf("expected downstream X-User-Email to be verified JWT email %s, got spoofed %s", realEmail, capturedEmail)
	}
}
