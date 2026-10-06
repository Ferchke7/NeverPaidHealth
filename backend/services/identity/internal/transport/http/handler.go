package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/identity/internal/application/command"
	"github.com/neverpaidhealth/backend/services/identity/internal/application/query"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type Handler struct {
	authGoogleHandler *command.AuthenticateGoogleHandler
	devLoginHandler   *command.DevLoginHandler
	updateUnitHandler *command.UpdateUnitPreferenceHandler
	getProfileHandler *query.GetProfileHandler
}

func NewHandler(
	authGoogle *command.AuthenticateGoogleHandler,
	devLogin *command.DevLoginHandler,
	updateUnit *command.UpdateUnitPreferenceHandler,
	getProfile *query.GetProfileHandler,
) *Handler {
	return &Handler{
		authGoogleHandler: authGoogle,
		devLoginHandler:   devLogin,
		updateUnitHandler: updateUnit,
		getProfileHandler: getProfile,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	// Auth routes (supporting both with and without /auth prefix)
	r.Post("/google", h.handleGoogleAuth)
	r.Post("/auth/google", h.handleGoogleAuth)
	r.Post("/dev-login", h.handleDevLogin)
	r.Post("/auth/dev-login", h.handleDevLogin)

	// Profile & Me routes
	r.Get("/me", h.handleGetMe)
	r.Get("/profile/me", h.handleGetMe)
	r.Put("/profile/unit-preference", h.handleUpdateUnitPreference)

	return r
}

type googleAuthReq struct {
	IDToken string `json:"id_token"`
}

type devLoginReq struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
}

type updateUnitReq struct {
	UnitPreference string `json:"unit_preference"`
}

type userResponse struct {
	ID             string `json:"id"`
	Email          string `json:"email"`
	DisplayName    string `json:"display_name"`
	AvatarURL      string `json:"avatar_url,omitempty"`
	UnitPreference string `json:"unit_preference"`
	CreatedAt      string `json:"created_at"`
}

type authResponse struct {
	AccessToken string       `json:"access_token"`
	ExpiresIn   int          `json:"expires_in"`
	User        userResponse `json:"user"`
}

func (h *Handler) handleGoogleAuth(w http.ResponseWriter, r *http.Request) {
	var req googleAuthReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	res, err := h.authGoogleHandler.Handle(r.Context(), req.IDToken)
	if err != nil {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", err.Error(), "ERR_AUTH_FAILED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapAuthResponse(res))
}

func (h *Handler) handleDevLogin(w http.ResponseWriter, r *http.Request) {
	var req devLoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	res, err := h.devLoginHandler.Handle(r.Context(), req.Email, req.DisplayName)
	if err != nil {
		httpx.WriteProblem(w, http.StatusForbidden, "Forbidden", err.Error(), "ERR_DEV_LOGIN_DISABLED")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapAuthResponse(res))
}

func (h *Handler) handleGetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "Missing user authentication context", "ERR_UNAUTHORIZED")
		return
	}

	u, err := h.getProfileHandler.Handle(r.Context(), userID)
	if err != nil {
		httpx.WriteProblem(w, http.StatusNotFound, "Not Found", "User profile not found", "ERR_USER_NOT_FOUND")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapUserResponse(u))
}

func (h *Handler) handleUpdateUnitPreference(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpx.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteProblem(w, http.StatusUnauthorized, "Unauthorized", "Missing user authentication context", "ERR_UNAUTHORIZED")
		return
	}

	var req updateUnitReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", "Invalid JSON body", "ERR_INVALID_BODY")
		return
	}

	u, err := h.updateUnitHandler.Handle(r.Context(), userID, req.UnitPreference)
	if err != nil {
		httpx.WriteProblem(w, http.StatusBadRequest, "Bad Request", err.Error(), "ERR_INVALID_UNIT_PREFERENCE")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, mapUserResponse(u))
}

func mapUserResponse(u *user.User) userResponse {
	return userResponse{
		ID:             u.ID().String(),
		Email:          u.Email().String(),
		DisplayName:    u.DisplayName(),
		AvatarURL:      u.AvatarURL(),
		UnitPreference: u.UnitPreference().String(),
		CreatedAt:      u.CreatedAt().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func mapAuthResponse(res *command.AuthResult) authResponse {
	return authResponse{
		AccessToken: res.AccessToken,
		ExpiresIn:   res.ExpiresIn,
		User:        mapUserResponse(res.User),
	}
}
