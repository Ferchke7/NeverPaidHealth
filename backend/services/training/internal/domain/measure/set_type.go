package measure

import "strings"

type SetType string

const (
	SetTypeNormal  SetType = "normal"
	SetTypeWarmup  SetType = "warmup"
	SetTypeDrop    SetType = "drop"
	SetTypeFailure SetType = "failure"
)

var validSetTypes = map[SetType]bool{
	SetTypeNormal:  true,
	SetTypeWarmup:  true,
	SetTypeDrop:    true,
	SetTypeFailure: true,
}

func NewSetType(val string) (SetType, error) {
	st := SetType(strings.ToLower(strings.TrimSpace(val)))
	if !validSetTypes[st] {
		return "", ErrInvalidSetType
	}
	return st, nil
}

func (s SetType) String() string {
	return string(s)
}

func (s SetType) IsWarmup() bool {
	return s == SetTypeWarmup
}
