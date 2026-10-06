package logx

import (
	"log/slog"
	"os"
)

func NewLogger(serviceName string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}).WithAttrs([]slog.Attr{
		slog.String("service", serviceName),
	})

	return slog.New(handler)
}
