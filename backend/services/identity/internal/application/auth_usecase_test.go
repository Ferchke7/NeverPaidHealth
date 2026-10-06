package application_test

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

type FixedClock struct {
	t time.Time
}

func (f FixedClock) Now() time.Time { return f.t }

func TestAuthenticateGoogle_FirstLoginRegisters_SubsequentLoginReturnsExisting(t *testing.T) {
	ctx := context.Background()
	clock := FixedClock{t: time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC)}

	fakeRepo := memory.NewFakeUserRepo()
	fakeVerifier := memory.NewFakeGoogleVerifier()
	fakeVerifier.Claims["valid-google-token"] = &application.GoogleClaims{
		Sub:         "google-sub-999",
		Email:       "athlete@neverpaid.dev",
		DisplayName: "New Athlete",
		AvatarURL:   "https://img.dev/pic.jpg",
	}

	priv, pub, _ := jwtauth.GenerateDevKeypair()
	tokenSvc := jwtauth.NewTokenService(priv, pub)

	handler := command.NewAuthenticateGoogleHandler(fakeVerifier, fakeRepo, tokenSvc, clock)

	// Act 1: First login (registers new user)
	res1, err := handler.Handle(ctx, "valid-google-token")
	if err != nil {
		t.Fatalf("first login failed: %v", err)
	}

	if res1.User.DisplayName() != "New Athlete" {
		t.Errorf("expected display name 'New Athlete', got %s", res1.User.DisplayName())
	}
	if res1.User.UnitPreference() != user.UnitKg {
		t.Errorf("expected default unit preference kg, got %s", res1.User.UnitPreference())
	}

	// Act 2: Second login with same sub (should return existing user without changing ID)
	res2, err := handler.Handle(ctx, "valid-google-token")
	if err != nil {
		t.Fatalf("second login failed: %v", err)
	}

	if res2.User.ID() != res1.User.ID() {
		t.Errorf("expected same user ID %v, got %v", res1.User.ID(), res2.User.ID())
	}
}

func TestDevLogin_DisabledInProduction_ReturnsError(t *testing.T) {
	ctx := context.Background()
	fakeRepo := memory.NewFakeUserRepo()
	priv, pub, _ := jwtauth.GenerateDevKeypair()
	tokenSvc := jwtauth.NewTokenService(priv, pub)

	handler := command.NewDevLoginHandler(fakeRepo, tokenSvc, FixedClock{t: time.Now()}, false) // devMode = false

	_, err := handler.Handle(ctx, "dev@test.com", "Dev User")
	if err == nil {
		t.Errorf("expected error when dev login is disabled, got nil")
	}
}

func TestUpdateUnitPreference_UpdatesUserSuccessfully(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	fakeRepo := memory.NewFakeUserRepo()

	email, _ := user.NewEmail("athlete@neverpaid.dev")
	u, _ := user.NewUser("sub-1", email, "Athlete", "", now)
	_ = fakeRepo.Save(ctx, u)

	handler := command.NewUpdateUnitPreferenceHandler(fakeRepo, FixedClock{t: now.Add(time.Minute)})
	updatedUser, err := handler.Handle(ctx, u.ID(), "lb")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if updatedUser.UnitPreference() != user.UnitLb {
		t.Errorf("expected unit preference lb, got %s", updatedUser.UnitPreference())
	}
}
