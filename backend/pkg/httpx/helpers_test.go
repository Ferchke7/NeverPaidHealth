package httpx_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/httpx"
)

func TestHelpers_QueryFunctions(t *testing.T) {
	req := httptest.NewRequest("GET", "/test?str=hello&num=42&flt=3.14", nil)

	if httpx.QueryString(req, "str", "def") != "hello" {
		t.Errorf("expected hello")
	}
	if httpx.QueryString(req, "missing", "def") != "def" {
		t.Errorf("expected def")
	}

	opt := httpx.QueryOptionalString(req, "str")
	if opt == nil || *opt != "hello" {
		t.Errorf("expected pointer to hello")
	}
	if httpx.QueryOptionalString(req, "missing") != nil {
		t.Errorf("expected nil for missing")
	}

	if httpx.QueryInt(req, "num", 0) != 42 {
		t.Errorf("expected 42")
	}
	if httpx.QueryInt(req, "invalid", 10) != 10 {
		t.Errorf("expected default 10")
	}

	if httpx.QueryFloat(req, "flt", 0.0) != 3.14 {
		t.Errorf("expected 3.14")
	}
	if httpx.QueryFloat(req, "missing", 1.5) != 1.5 {
		t.Errorf("expected default 1.5")
	}
}

func TestHelpers_URLParamUUID(t *testing.T) {
	expectedID := uuid.New()
	r := chi.NewRouter()
	r.Get("/items/{id}", func(w http.ResponseWriter, req *http.Request) {
		id, err := httpx.URLParamUUID(req, "id")
		if err != nil || id != expectedID {
			t.Errorf("expected %v, got %v, err: %v", expectedID, id, err)
		}

		pathID, ok := httpx.PathUUID(w, req, "id")
		if !ok || pathID != expectedID {
			t.Errorf("expected PathUUID success")
		}
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/items/"+expectedID.String(), nil)
	r.ServeHTTP(rec, req)
}

func TestHelpers_DecodeJSON(t *testing.T) {
	type sample struct {
		Name string `json:"name"`
	}

	body := bytes.NewBufferString(`{"name":"Alex"}`)
	req := httptest.NewRequest("POST", "/test", body)
	rec := httptest.NewRecorder()

	val, ok := httpx.DecodeJSON[sample](rec, req)
	if !ok || val.Name != "Alex" {
		t.Fatalf("expected successful decode")
	}
}

func TestHelpers_RequireAuth(t *testing.T) {
	called := false
	testUserID := uuid.New()

	handler := httpx.RequireAuth(func(w http.ResponseWriter, r *http.Request, uid uuid.UUID) {
		called = true
		if uid != testUserID {
			t.Errorf("expected user ID %v, got %v", testUserID, uid)
		}
	})

	req := httptest.NewRequest("GET", "/", nil)
	ctx := context.WithValue(req.Context(), httpx.UserIDContextKey, testUserID)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handler(rec, req)
	if !called {
		t.Errorf("expected handler to be called")
	}
}
