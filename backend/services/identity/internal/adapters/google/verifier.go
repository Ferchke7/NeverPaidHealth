package google

import (
	"context"
	"fmt"

	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"google.golang.org/api/idtoken"
)

type TokenVerifier struct {
	clientID string
}

func NewTokenVerifier(clientID string) *TokenVerifier {
	return &TokenVerifier{clientID: clientID}
}

func (v *TokenVerifier) VerifyIDToken(ctx context.Context, tokenStr string) (*application.GoogleClaims, error) {
	payload, err := idtoken.Validate(ctx, tokenStr, v.clientID)
	if err != nil {
		return nil, fmt.Errorf("invalid google id token: %w", err)
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	return &application.GoogleClaims{
		Sub:         payload.Subject,
		Email:       email,
		DisplayName: name,
		AvatarURL:   picture,
	}, nil
}
