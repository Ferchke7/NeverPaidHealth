package httpx

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type contextKey string

const UserIDContextKey contextKey = "user_id"

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	val, ok := ctx.Value(UserIDContextKey).(uuid.UUID)
	return val, ok
}

func ContextWithUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, UserIDContextKey, userID)
}

func UserIDFromRequest(r *http.Request) (uuid.UUID, bool) {
	if val, ok := UserIDFromContext(r.Context()); ok && val != uuid.Nil {
		return val, true
	}
	for _, hdr := range []string{"X-User-Id", "X-User-ID", "x-user-id"} {
		if valStr := strings.TrimSpace(r.Header.Get(hdr)); valStr != "" {
			if id, err := uuid.Parse(valStr); err == nil && id != uuid.Nil {
				return id, true
			}
		}
	}
	return uuid.Nil, false
}

func ExtractUserHeaderMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id, ok := UserIDFromRequest(r); ok {
			ctx := ContextWithUserID(r.Context(), id)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		next.ServeHTTP(w, r)
	})
}
