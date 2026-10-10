package proxy

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/neverpaidhealth/backend/gateway/internal/config"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/pkg/jwtauth"
)

func NewRouter(cfg *config.Config, tokenService *jwtauth.TokenService, logger *slog.Logger) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(httpx.RequestLogger(logger))
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "If-None-Match", "X-User-Id"},
		ExposedHeaders:   []string{"Link", "ETag"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	identityProxy := newReverseProxy(cfg.IdentityURL)
	exerciseProxy := newReverseProxy(cfg.ExerciseURL)
	trainingProxy := newReverseProxy(cfg.TrainingURL)
	progressProxy := newReverseProxy(cfg.ProgressURL)
	bodyProxy := newReverseProxy(cfg.BodyURL)
	coachProxy := newReverseProxy(cfg.CoachURL)
	todoProxy := newReverseProxy(cfg.TodoURL)

	authMw := AuthMiddleware(tokenService)

	r.Route("/api/v1", func(api chi.Router) {
		// Public Identity Endpoints
		api.Mount("/auth", identityProxy)

		// Authenticated Routes
		api.Group(func(authed chi.Router) {
			authed.Use(authMw)

			authed.Mount("/me", identityProxy)
			authed.Mount("/profile", identityProxy)
			authed.Mount("/exercises", exerciseProxy)
			authed.Mount("/routines", trainingProxy)
			authed.Mount("/workouts", trainingProxy)
			authed.Mount("/programs", trainingProxy)
			authed.Mount("/progress", progressProxy)
			authed.Mount("/body", bodyProxy)
			authed.Mount("/coach", coachProxy)
			authed.Mount("/nutrition", coachProxy)
			authed.Mount("/todos", todoProxy)
			authed.Mount("/schedule", todoProxy)
			authed.Mount("/activity-logs", todoProxy)
		})
	})

	return r
}

func newReverseProxy(target string) http.Handler {
	targetURL, err := url.Parse(target)
	if err != nil {
		panic(err)
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	originalDirector := proxy.Director

	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		req.Host = targetURL.Host

		// Strip /api/v1 prefix so downstream microservices receive clean paths
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/api/v1")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		if req.URL.RawPath != "" {
			req.URL.RawPath = strings.TrimPrefix(req.URL.RawPath, "/api/v1")
		}
	}

	return proxy
}
