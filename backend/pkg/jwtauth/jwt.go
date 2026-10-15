package jwtauth

import (
	"crypto/ed25519"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid or tampered jwt token")
	ErrExpiredToken = errors.New("jwt token has expired")
)

type UserClaims struct {
	jwt.RegisteredClaims
	UserID uuid.UUID `json:"uid"`
	Email  string    `json:"email"`
}

type TokenService struct {
	privKey ed25519.PrivateKey
	pubKey  ed25519.PublicKey
}

const DefaultDevSecret = "neverpaid_dev_jwt_secret_seed_32bytes_value_key!!"

func NewTokenService(priv ed25519.PrivateKey, pub ed25519.PublicKey) *TokenService {
	return &TokenService{privKey: priv, pubKey: pub}
}

// GenerateDevKeypair returns a deterministic dev keypair shared across services
func GenerateDevKeypair() (ed25519.PrivateKey, ed25519.PublicKey, error) {
	return NewKeypairFromSecret(DefaultDevSecret)
}

// NewTokenServiceFromEnv creates a TokenService using JWT_SECRET from environment.
// In production (APP_ENV=production or ENVIRONMENT=production), it enforces that JWT_SECRET is set,
// is not the default development secret, and is at least 32 characters.
func NewTokenServiceFromEnv() (*TokenService, error) {
	secret := os.Getenv("JWT_SECRET")
	appEnv := strings.ToLower(os.Getenv("APP_ENV"))
	if appEnv == "" {
		appEnv = strings.ToLower(os.Getenv("ENVIRONMENT"))
	}
	isProd := appEnv == "production" || appEnv == "prod"

	if isProd {
		if secret == "" {
			return nil, errors.New("JWT_SECRET environment variable is mandatory in production")
		}
		if secret == DefaultDevSecret {
			return nil, errors.New("default development JWT secret cannot be used in production")
		}
		if len(secret) < 32 {
			return nil, errors.New("JWT_SECRET must be at least 32 characters in production")
		}
	} else if secret == "" {
		secret = DefaultDevSecret
	}

	priv, pub, err := NewKeypairFromSecret(secret)
	if err != nil {
		return nil, err
	}
	return NewTokenService(priv, pub), nil
}

// NewKeypairFromSecret derives an Ed25519 keypair deterministically from a shared secret
func NewKeypairFromSecret(secret string) (ed25519.PrivateKey, ed25519.PublicKey, error) {
	if secret == "" {
		secret = DefaultDevSecret
	}
	hash := sha256.Sum256([]byte(secret))
	priv := ed25519.NewKeyFromSeed(hash[:])
	pub := priv.Public().(ed25519.PublicKey)
	return priv, pub, nil
}

func (s *TokenService) IssueAccessToken(userID uuid.UUID, email string, duration time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := UserClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
			Issuer:    "neverpaidhealth-identity",
		},
		UserID: userID,
		Email:  email,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	signedToken, err := token.SignedString(s.privKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signedToken, nil
}

func (s *TokenService) VerifyAccessToken(tokenString string) (*UserClaims, error) {
	parsedToken, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.pubKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := parsedToken.Claims.(*UserClaims)
	if !ok || !parsedToken.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
