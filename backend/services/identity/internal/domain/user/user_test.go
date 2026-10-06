package user_test

import (
	"testing"
	"time"

	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

func TestUser_NewUser_SetsDefaultsCorrectly(t *testing.T) {
	now := time.Now().UTC()
	email, err := user.NewEmail("athlete@neverpaid.dev")
	if err != nil {
		t.Fatalf("unexpected error creating email: %v", err)
	}

	u, err := user.NewUser("sub-12345", email, "Athletic User", "https://img.dev/avatar.png", now)
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}

	if u.UnitPreference() != user.UnitKg {
		t.Errorf("expected default unit preference to be kg, got %s", u.UnitPreference())
	}
	if u.Email().String() != "athlete@neverpaid.dev" {
		t.Errorf("expected email athlete@neverpaid.dev, got %s", u.Email().String())
	}
}

func TestUser_UpdateUnitPreference_TogglesUnit(t *testing.T) {
	now := time.Now().UTC()
	email, _ := user.NewEmail("athlete@neverpaid.dev")
	u, _ := user.NewUser("sub-12345", email, "Athletic User", "", now)

	lbPref, err := user.NewUnitPreference("lb")
	if err != nil {
		t.Fatalf("unexpected error creating unit preference: %v", err)
	}

	later := now.Add(5 * time.Minute)
	u.UpdateUnitPreference(lbPref, later)

	if u.UnitPreference() != user.UnitLb {
		t.Errorf("expected unit preference lb, got %s", u.UnitPreference())
	}
	if !u.UpdatedAt().Equal(later) {
		t.Errorf("expected updatedAt to be %v, got %v", later, u.UpdatedAt())
	}
}

func TestUser_Validation_RejectsInvalidInputs(t *testing.T) {
	_, err := user.NewEmail("not-an-email")
	if err != user.ErrInvalidEmail {
		t.Errorf("expected ErrInvalidEmail, got %v", err)
	}

	_, err = user.NewUnitPreference("stones")
	if err != user.ErrInvalidUnitPreference {
		t.Errorf("expected ErrInvalidUnitPreference, got %v", err)
	}
}
