package logx

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/lmittmann/tint"
)

type contextKey string

const loggerContextKey contextKey = "slog_logger"

// NewLogger creates a structured logger tailored for the current environment.
// In development, it uses 'tint' for beautiful, colorized console logs.
// In production (or when LOG_FORMAT=json), it outputs high-performance structured JSON.
func NewLogger(serviceName string) *slog.Logger {
	level := parseLogLevel(os.Getenv("LOG_LEVEL"))
	format := strings.ToLower(os.Getenv("LOG_FORMAT"))
	env := strings.ToLower(os.Getenv("ENV"))
	if env == "" {
		env = strings.ToLower(os.Getenv("ENVIRONMENT"))
	}
	if env == "" {
		env = strings.ToLower(os.Getenv("APP_ENV"))
	}

	var handler slog.Handler

	isProd := env == "production" || env == "prod"
	if format == "json" || (format == "" && isProd) {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level:     level,
			AddSource: isProd, // Include file:line in production JSON
		})
	} else {
		// Dev / Pretty terminal handler with vibrant colors and clean formatting
		handler = tint.NewHandler(os.Stdout, &tint.Options{
			Level:      level,
			TimeFormat: time.Kitchen, // e.g. "3:04PM" or "15:04:05"
			AddSource:  false,
			NoColor:    false,
		})
	}

	logger := slog.New(handler).With("service", serviceName)
	slog.SetDefault(logger)
	return logger
}

func parseLogLevel(lvl string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(lvl)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	case "info":
		return slog.LevelInfo
	default:
		return slog.LevelInfo
	}
}

// WithContext stores a logger instance inside context.Context
func WithContext(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerContextKey, logger)
}

// FromContext extracts the logger from context or falls back to slog.Default()
func FromContext(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(loggerContextKey).(*slog.Logger); ok && logger != nil {
		return logger
	}
	return slog.Default()
}
