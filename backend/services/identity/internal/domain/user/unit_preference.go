package user

import "strings"

type UnitPreference string

const (
	UnitKg UnitPreference = "kg"
	UnitLb UnitPreference = "lb"
)

func NewUnitPreference(val string) (UnitPreference, error) {
	switch strings.ToLower(strings.TrimSpace(val)) {
	case "kg":
		return UnitKg, nil
	case "lb":
		return UnitLb, nil
	default:
		return "", ErrInvalidUnitPreference
	}
}

func (u UnitPreference) String() string {
	return string(u)
}
