package jwtauth_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/jwtauth"
)

func TestTokenService_IssueAndVerify_ValidToken(t *testing.T) {
	priv, pub, err := jwtauth.GenerateDevKeypair()
	if err != nil {
		t.Fatalf("unexpected error generating keypair: %v", err)
	}

	svc := jwtauth.NewTokenService(priv, pub)
	expectedUserID := uuid.New()
	expectedEmail := "athlete@neverpaid.dev"

	token, err := svc.IssueAccessToken(expectedUserID, expectedEmail, 15*time.Minute)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	claims, err := svc.VerifyAccessToken(token)
	if err != nil {
		t.Fatalf("expected valid token, got error: %v", err)
	}

	if claims.UserID != expectedUserID {
		t.Errorf("expected user ID %v, got %v", expectedUserID, claims.UserID)
	}
	if claims.Email != expectedEmail {
		t.Errorf("expected email %s, got %s", expectedEmail, claims.Email)
	}
}

func TestTokenService_Verify_ExpiredToken_ReturnsErrExpired(t *testing.T) {
	priv, pub, err := jwtauth.GenerateDevKeypair()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	svc := jwtauth.NewTokenService(priv, pub)
	token, err := svc.IssueAccessToken(uuid.New(), "expired@neverpaid.dev", -1*time.Minute)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	_, err = svc.VerifyAccessToken(token)
	if !errors.Is(err, jwtauth.ErrExpiredToken) {
		t.Errorf("expected ErrExpiredToken, got %v", err)
	}
}

func TestTokenService_Verify_TamperedToken_ReturnsErrInvalid(t *testing.T) {
	priv, pub, _ := jwtauth.GenerateDevKeypair()
	svc := jwtauth.NewTokenService(priv, pub)

	token, _ := svc.IssueAccessToken(uuid.New(), "athlete@neverpaid.dev", 15*time.Minute)
	tamperedToken := token[:len(token)-5] + "AAAAA"

	_, err := svc.VerifyAccessToken(tamperedToken)
	if !errors.Is(err, jwtauth.ErrInvalidToken) {
		t.Errorf("expected ErrInvalidToken, got %v", err)
	}
}

func TestTokenServiceFromEnv_ProductionEnforcement(t *testing.T) {
	// Dev mode fallback
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "")
	svc, err := jwtauth.NewTokenServiceFromEnv()
	if err != nil || svc == nil {
		t.Fatalf("expected valid service in dev mode, got error: %v", err)
	}

	// Production with missing secret fails
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "")
	_, err = jwtauth.NewTokenServiceFromEnv()
	if err == nil {
		t.Fatal("expected error in production when JWT_SECRET is empty")
	}

	// Production with default dev secret fails
	t.Setenv("JWT_SECRET", jwtauth.DefaultDevSecret)
	_, err = jwtauth.NewTokenServiceFromEnv()
	if err == nil {
		t.Fatal("expected error in production when JWT_SECRET is default dev secret")
	}

	// Production with short secret fails
	t.Setenv("JWT_SECRET", "short_secret")
	_, err = jwtauth.NewTokenServiceFromEnv()
	if err == nil {
		t.Fatal("expected error in production when JWT_SECRET is too short")
	}

	// Production with valid strong secret succeeds
	t.Setenv("JWT_SECRET", "super_strong_production_secret_key_32chars!!")
	svc, err = jwtauth.NewTokenServiceFromEnv()
	if err != nil || svc == nil {
		t.Fatalf("expected success with valid secret, got: %v", err)
	}
}

