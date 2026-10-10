package httpx

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// DecodeJSON decodes the JSON request body into the specified type T.
// If decoding fails, it writes an RFC 7807 problem details response with 400 Bad Request
// and returns false.
func DecodeJSON[T any](w http.ResponseWriter, r *http.Request) (T, bool) {
	var v T
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		WriteProblem(w, http.StatusBadRequest, "Bad Request", fmt.Sprintf("Invalid JSON body: %s", err.Error()), "ERR_INVALID_BODY")
		return v, false
	}
	return v, true
}

// PathUUID extracts and parses a UUID from the chi URL parameters.
// If the parameter is missing or invalid, it writes an RFC 7807 problem details response
// with 400 Bad Request and returns uuid.Nil, false.
func PathUUID(w http.ResponseWriter, r *http.Request, paramName string) (uuid.UUID, bool) {
	val := chi.URLParam(r, paramName)
	if val == "" {
		WriteProblem(w, http.StatusBadRequest, "Bad Request", fmt.Sprintf("Missing required URL parameter: %s", paramName), "ERR_MISSING_PARAM")
		return uuid.Nil, false
	}
	id, err := uuid.Parse(val)
	if err != nil {
		WriteProblem(w, http.StatusBadRequest, "Bad Request", fmt.Sprintf("Invalid UUID parameter '%s': %s", paramName, val), "ERR_INVALID_UUID")
		return uuid.Nil, false
	}
	return id, true
}

// URLParamUUID parses a UUID parameter from URL without writing an HTTP response.
func URLParamUUID(r *http.Request, paramName string) (uuid.UUID, error) {
	val := chi.URLParam(r, paramName)
	if val == "" {
		return uuid.Nil, fmt.Errorf("missing URL parameter %s", paramName)
	}
	return uuid.Parse(val)
}

// QueryString returns the query string value or defaultVal if empty.
func QueryString(r *http.Request, paramName, defaultVal string) string {
	val := strings.TrimSpace(r.URL.Query().Get(paramName))
	if val == "" {
		return defaultVal
	}
	return val
}

// QueryOptionalString returns pointer to query string or nil if not present.
func QueryOptionalString(r *http.Request, paramName string) *string {
	val := strings.TrimSpace(r.URL.Query().Get(paramName))
	if val == "" {
		return nil
	}
	return &val
}

// QueryInt returns integer query parameter or defaultVal if missing or invalid.
func QueryInt(r *http.Request, paramName string, defaultVal int) int {
	valStr := strings.TrimSpace(r.URL.Query().Get(paramName))
	if valStr == "" {
		return defaultVal
	}
	parsed, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultVal
	}
	return parsed
}

// QueryFloat returns float64 query parameter or defaultVal if missing or invalid.
func QueryFloat(r *http.Request, paramName string, defaultVal float64) float64 {
	valStr := strings.TrimSpace(r.URL.Query().Get(paramName))
	if valStr == "" {
		return defaultVal
	}
	parsed, err := strconv.ParseFloat(valStr, 64)
	if err != nil {
		return defaultVal
	}
	return parsed
}
