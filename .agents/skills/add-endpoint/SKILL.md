---
name: add-endpoint
description: Contract-first recipe for introducing a new HTTP endpoint.
---

# Recipe: Adding an Endpoint (Contract-First)

1. **Update OpenAPI Contract First:**
   Add path, request body, parameters, and response schemas to `contracts/openapi/<service>.yaml`.
   Use standard RFC 7807 `ProblemDetails` for errors.

2. **Generate Server Stubs & Client:**
   Run:
   ```bash
   task gen
   ```

3. **Implement Transport Handler:**
   Update `internal/transport/http/handler.go` implementing the generated strict server interface.
   Convert incoming HTTP DTO -> Application Command/Query -> Application Handler -> Return HTTP DTO.

4. **Verify Gateway Routing:**
   Ensure `backend/gateway/internal/proxy/router.go` routes the path to the correct service.

5. **Verify With Task:**
   Run `task verify` to ensure compile-time adherence.
