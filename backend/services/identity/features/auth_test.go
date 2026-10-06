package features_test

import (
	"context"
	"testing"
	"time"

	"github.com/neverpaidhealth/backend/pkg/jwtauth"
	"github.com/neverpaidhealth/backend/services/identity/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"github.com/neverpaidhealth/backend/services/identity/internal/application/command"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

func TestBDD_Identity_FirstTimeGoogleLoginRegistersUser(t *testing.T) {
	// Scenario: First-time Google login registers a new user with default kg units
	ctx := context.Background()
	now := time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC)

	fakeRepo := memory.NewFakeUserRepo()
	fakeVerifier := memory.NewFakeGoogleVerifier()
	fakeVerifier.Claims["google-token-1"] = &application.GoogleClaims{
		Sub:         "google-sub-123",
		Email:       "athlete@example.com",
		DisplayName: "New Athlete",
	}

	priv, pub, _ := jwtauth.GenerateDevKeypair()
	tokenSvc := jwtauth.NewTokenService(priv, pub)

	handler := command.NewAuthenticateGoogleHandler(fakeVerifier, fakeRepo, tokenSvc, fixedClock{t: now})

	// When
	result, err := handler.Handle(ctx, "google-token-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Then
	if result.User.Email().String() != "athlete@example.com" {
		t.Errorf("expected email athlete@example.com, got %s", result.User.Email())
	}
	if result.User.UnitPreference() != user.UnitKg {
		t.Errorf("expected unit preference kg, got %s", result.User.UnitPreference())
	}
	if result.AccessToken == "" {
		t.Errorf("expected non-empty access token")
	}
}

func TestBDD_Identity_UpdateUnitPreference(t *testing.T) {
	// Scenario: User updates unit preference to pounds
	ctx := context.Background()
	now := time.Now().UTC()
	fakeRepo := memory.NewFakeUserRepo()

	email, _ := user.NewEmail("athlete@example.com")
	u, _ := user.NewUser("sub-123", email, "Athlete", "", now)
	_ = fakeRepo.Save(ctx, u)

	handler := command.NewUpdateUnitPreferenceHandler(fakeRepo, fixedClock{t: now})

	// When
	updated, err := handler.Handle(ctx, u.ID(), "lb")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Then
	if updated.UnitPreference() != user.UnitLb {
		t.Errorf("expected unit preference lb, got %s", updated.UnitPreference())
	}
}

type fixedClock struct{ t time.Time }

func (f fixedClock) Now() time.Time { return f.t }
