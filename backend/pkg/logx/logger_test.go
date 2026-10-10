package logx_test

import (
	"bytes"
	"context"
	"os"
	"testing"

	"github.com/neverpaidhealth/backend/pkg/logx"
)

func TestNewLogger(t *testing.T) {
	os.Setenv("LOG_LEVEL", "debug")
	os.Setenv("LOG_FORMAT", "tint")

	logger := logx.NewLogger("test-service")
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}

	logger.Info("testing info log", "key", "value")
	logger.Debug("testing debug log", "number", 42)
	logger.Warn("testing warn log", "warning", "check this")
	logger.Error("testing error log", "err_code", 500)
}

func TestContextLogger(t *testing.T) {
	logger := logx.NewLogger("ctx-service")
	ctx := logx.WithContext(context.Background(), logger)

	extracted := logx.FromContext(ctx)
	if extracted == nil {
		t.Fatal("expected logger from context")
	}

	defaultLogger := logx.FromContext(context.Background())
	if defaultLogger == nil {
		t.Fatal("expected default logger fallback")
	}
}

func TestProductionJSONLogger(t *testing.T) {
	os.Setenv("LOG_FORMAT", "json")
	os.Setenv("ENV", "production")

	var buf bytes.Buffer
	logger := logx.NewLogger("prod-service")
	if logger == nil {
		t.Fatal("expected non-nil prod logger")
	}

	_ = buf
}
