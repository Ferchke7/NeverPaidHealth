package config

import (
	"os"
)

type Config struct {
	Port         string
	IdentityURL  string
	ExerciseURL  string
	TrainingURL  string
	ProgressURL  string
	BodyURL      string
	CoachURL     string
	TodoURL      string
	CORSOrigin   string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("GATEWAY_PORT", "8080"),
		IdentityURL: getEnv("IDENTITY_SERVICE_URL", "http://localhost:8081"),
		ExerciseURL: getEnv("EXERCISE_SERVICE_URL", "http://localhost:8082"),
		TrainingURL: getEnv("TRAINING_SERVICE_URL", "http://localhost:8083"),
		ProgressURL: getEnv("PROGRESS_SERVICE_URL", "http://localhost:8084"),
		BodyURL:     getEnv("BODY_SERVICE_URL", "http://localhost:8085"),
		CoachURL:    getEnv("COACH_SERVICE_URL", "http://localhost:8086"),
		TodoURL:     getEnv("TODO_SERVICE_URL", "http://localhost:8087"),
		CORSOrigin:  getEnv("CORS_ORIGIN", "http://localhost:5173"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
