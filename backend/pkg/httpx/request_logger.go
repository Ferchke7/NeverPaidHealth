package httpx

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// RequestLogger returns a Chi middleware that logs HTTP requests with structured slog attributes.
func RequestLogger(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			start := time.Now()

			defer func() {
				duration := time.Since(start)
				status := ww.Status()
				if status == 0 {
					status = http.StatusOK
				}

				attrs := []slog.Attr{
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Int("status", status),
					slog.Duration("duration", duration),
					slog.Int("bytes", ww.BytesWritten()),
					slog.String("ip", r.RemoteAddr),
				}

				if reqID := middleware.GetReqID(r.Context()); reqID != "" {
					attrs = append(attrs, slog.String("req_id", reqID))
				}

				if userID, ok := UserIDFromContext(r.Context()); ok {
					attrs = append(attrs, slog.String("user_id", userID.String()))
				}

				level := slog.LevelInfo
				msg := "HTTP request completed"
				if status >= 500 {
					level = slog.LevelError
					msg = "HTTP request failed"
				} else if status >= 400 {
					level = slog.LevelWarn
					msg = "HTTP client error"
				}

				logger.LogAttrs(r.Context(), level, msg, attrs...)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
