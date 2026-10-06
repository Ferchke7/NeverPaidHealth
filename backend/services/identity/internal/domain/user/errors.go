package user

import "errors"

var (
	ErrInvalidEmail          = errors.New("invalid email address format")
	ErrInvalidUnitPreference = errors.New("unit preference must be 'kg' or 'lb'")
	ErrEmptyDisplayName      = errors.New("display name cannot be empty")
	ErrUserNotFound          = errors.New("user not found")
)
