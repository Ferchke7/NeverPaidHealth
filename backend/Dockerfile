# Multi-stage Dockerfile for NeverPaidHealth Go backend services
ARG SERVICE_NAME=gateway

# --- Build Stage ---
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache git ca-certificates

# Copy go workspaces and module definitions
COPY go.work go.work.sum* ./
COPY pkg/go.mod pkg/go.sum* ./pkg/
COPY gateway/go.mod gateway/go.sum* ./gateway/
COPY services/identity/go.mod services/identity/go.sum* ./services/identity/
COPY services/exercise/go.mod services/exercise/go.sum* ./services/exercise/
COPY services/training/go.mod services/training/go.sum* ./services/training/
COPY services/progress/go.mod services/progress/go.sum* ./services/progress/
COPY services/body/go.mod services/body/go.sum* ./services/body/
COPY services/coach/go.mod services/coach/go.sum* ./services/coach/
COPY archtest/go.mod archtest/go.sum* ./archtest/

# Download dependencies
RUN go work sync || true

# Copy source code
COPY pkg/ ./pkg/
COPY gateway/ ./gateway/
COPY services/ ./services/
COPY archtest/ ./archtest/

ARG SERVICE_NAME
ARG CMD_PATH

# Build target binary with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/service ${CMD_PATH}

# --- Runtime Stage ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/bin/service /app/service

EXPOSE 8080 8081 8082 8083 8084 8085

ENTRYPOINT ["/app/service"]
