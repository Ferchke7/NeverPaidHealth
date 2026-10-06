module github.com/neverpaidhealth/backend/gateway

go 1.24

replace github.com/neverpaidhealth/backend/pkg => ../pkg

require (
	github.com/go-chi/chi/v5 v5.2.1
	github.com/go-chi/cors v1.2.1
	github.com/neverpaidhealth/backend/pkg v0.0.0-00010101000000-000000000000
)

require (
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
)
