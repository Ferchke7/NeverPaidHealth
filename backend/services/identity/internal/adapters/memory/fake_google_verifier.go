package memory

import (
	"context"
	"errors"

	"github.com/neverpaidhealth/backend/services/identity/internal/application"
)

type FakeGoogleVerifier struct {
	Claims map[string]*application.GoogleClaims
}

func NewFakeGoogleVerifier() *FakeGoogleVerifier {
	return &FakeGoogleVerifier{
		Claims: make(map[string]*application.GoogleClaims),
	}
}

func (f *FakeGoogleVerifier) VerifyIDToken(ctx context.Context, idToken string) (*application.GoogleClaims, error) {
	if claims, ok := f.Claims[idToken]; ok {
		return claims, nil
	}
	return nil, errors.New("invalid fake google token")
}
