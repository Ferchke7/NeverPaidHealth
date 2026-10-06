package proxy

import (
	"net/http"
	"strings"

	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/pkg/jwtauth"
)

func AuthMiddleware(tokenService *jwtauth.TokenService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "Missing Authorization header", "ERR_MISSING_AUTH")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "Invalid Authorization header format", "ERR_INVALID_AUTH_HEADER")
				return
			}

			claims, err := tokenService.VerifyAccessToken(parts[1])
			if err != nil {
				httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "Invalid or expired token", "ERR_INVALID_TOKEN")
				return
			}

			r.Header.Set("X-User-Id", claims.UserID.String())
			r.Header.Set("X-User-Email", claims.Email)

			next.ServeHTTP(w, r)
		})
	}
}
