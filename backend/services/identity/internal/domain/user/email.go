package user

import (
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

type Email struct {
	value string
}

func NewEmail(val string) (Email, error) {
	trimmed := strings.TrimSpace(strings.ToLower(val))
	if !emailRegex.MatchString(trimmed) {
		return Email{}, ErrInvalidEmail
	}
	return Email{value: trimmed}, nil
}

func (e Email) String() string {
	return e.value
}
