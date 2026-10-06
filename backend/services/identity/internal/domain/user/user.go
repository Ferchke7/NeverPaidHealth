package user

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type User struct {
	id             uuid.UUID
	googleSub      string
	email          Email
	displayName    string
	avatarURL      string
	unitPreference UnitPreference
	createdAt      time.Time
	updatedAt      time.Time
}

func NewUser(googleSub string, email Email, displayName, avatarURL string, now time.Time) (*User, error) {
	trimmedName := strings.TrimSpace(displayName)
	if trimmedName == "" {
		return nil, ErrEmptyDisplayName
	}

	return &User{
		id:             uuid.New(),
		googleSub:      googleSub,
		email:          email,
		displayName:    trimmedName,
		avatarURL:      avatarURL,
		unitPreference: UnitKg, // Default unit preference
		createdAt:      now,
		updatedAt:      now,
	}, nil
}

func Reconstitute(id uuid.UUID, googleSub string, email Email, displayName, avatarURL string, unitPref UnitPreference, createdAt, updatedAt time.Time) *User {
	return &User{
		id:             id,
		googleSub:      googleSub,
		email:          email,
		displayName:    displayName,
		avatarURL:      avatarURL,
		unitPreference: unitPref,
		createdAt:      createdAt,
		updatedAt:      updatedAt,
	}
}

func (u *User) ID() uuid.UUID { return u.id }
func (u *User) GoogleSub() string { return u.googleSub }
func (u *User) Email() Email { return u.email }
func (u *User) DisplayName() string { return u.displayName }
func (u *User) AvatarURL() string { return u.avatarURL }
func (u *User) UnitPreference() UnitPreference { return u.unitPreference }
func (u *User) CreatedAt() time.Time { return u.createdAt }
func (u *User) UpdatedAt() time.Time { return u.updatedAt }

func (u *User) UpdateUnitPreference(pref UnitPreference, now time.Time) {
	u.unitPreference = pref
	u.updatedAt = now
}
