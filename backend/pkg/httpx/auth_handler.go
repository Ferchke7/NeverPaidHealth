package httpx

import (
	"net/http"

	"github.com/google/uuid"
)

type AuthFuncHandler func(w http.ResponseWriter, r *http.Request, userID uuid.UUID)

func RequireAuth(fn AuthFuncHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromRequest(r)
		if !ok {
			WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "User context required", "ERR_UNAUTHORIZED")
			return
		}
		fn(w, r, userID)
	}
}
