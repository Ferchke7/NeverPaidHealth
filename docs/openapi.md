# NeverPaidHealth — OpenAPI 3.1 & REST API Documentation

Comprehensive English documentation for the NeverPaidHealth REST microservices architecture.

---

## 🌐 Environments & Base URLs

| Environment | Base URL | Description |
| :--- | :--- | :--- |
| **Local Development** | `http://localhost:8080/api/v1` | Local API Gateway routing to Go microservices |
| **Live Production** | `http://54.38.156.226:3002/api/v1` | Production deployment on `codeguru.ovh` |

The master OpenAPI 3.1.0 specification is available at [`contracts/openapi/openapi.yaml`](../contracts/openapi/openapi.yaml).

---

## 🔐 Authentication & Security

All authenticated endpoints require a standard RFC 6750 **JWT Bearer Token** in the HTTP `Authorization` header:

```http
Authorization: Bearer <your_jwt_access_token>
```

### 1. Developer Login (Quick Access)
* **Method & Path**: `POST /api/v1/auth/dev-login`
* **Access**: Public (Active when `AUTH_DEV_MODE=true`)
* **Description**: Instantly generates an authenticated JWT session for any test user.

**Request Body:**
```json
{
  "email": "athlete@neverpaid.health",
  "display_name": "Alex Johnson"
}
```

**Response (`200 OK`):**
```json
{
  "access_token": "eyJhbGciOiJFUzI1NiIs...",
  "token_type": "Bearer",
  "user": {
    "id": "c7913361-b485-48fa-8698-c117b1ecba3a",
    "email": "athlete@neverpaid.health",
    "display_name": "Alex Johnson",
    "unit_preference": "kg",
    "is_pro": true
  }
}
```

### 2. Google OAuth 2.0 Login
* **Method & Path**: `POST /api/v1/auth/google`
* **Access**: Public
* **Request Body**: `{ "id_token": "..." }`

---

## 👤 1. Athlete Profile & Settings (`/profile`)

### `GET /api/v1/profile/me`
* **Security**: `BearerAuth`
* **Description**: Returns the authenticated athlete profile, lifetime statistics, and unit preference.

### `PUT /api/v1/profile/units`
* **Security**: `BearerAuth`
* **Description**: Updates the athlete's weight & measurement unit preference (`kg` or `lb`).

**Request Body:**
```json
{
  "unit_preference": "lb"
}
```

---

## 🏋️‍♂️ 2. Movement & Exercise Catalog (`/exercises`)

### `GET /api/v1/exercises`
* **Security**: `BearerAuth`
* **Query Parameters**:
  * `muscle_group` *(optional)*: `chest`, `back`, `shoulders`, `biceps`, `triceps`, `quads`, `hamstrings`, `glutes`, `calves`, `core`, `full_body`
  * `equipment` *(optional)*: `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`, `kettlebell`
  * `search` *(optional)*: Substring query string
  * `limit` *(default: 50)*
  * `offset` *(default: 0)*

**Response (`200 OK`):**
```json
[
  {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "Barbell Incline Bench Press",
    "primary_muscle": "chest",
    "secondary_muscles": ["shoulders", "triceps"],
    "category": "barbell",
    "measurement_type": "weight_reps",
    "instructions": "Set bench to 30 degrees. Retract scapula, lower bar to upper chest, press up explosively."
  }
]
```

### `GET /api/v1/exercises/{id}`
* **Security**: `BearerAuth`
* **Description**: Returns detailed execution guide and media assets for a specific exercise.

---

## 📋 3. Routine Templates (`/routines`)

### `GET /api/v1/routines`
* **Security**: `BearerAuth`
* **Description**: Fetches standard program library templates (Jeff Nippard PPL, Arnold Split, Upper/Lower) and user custom routines.

### `POST /api/v1/routines`
* **Security**: `BearerAuth`
* **Description**: Creates a new custom routine template.

**Request Body:**
```json
{
  "name": "Hypertrophy Push Session",
  "description": "Chest, Front Delts & Triceps Focus",
  "exercises": [
    {
      "exercise_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "exercise_name": "Barbell Incline Bench Press",
      "order_index": 1,
      "target_sets": 4,
      "target_reps_min": 6,
      "target_reps_max": 10,
      "rest_seconds": 120
    }
  ]
}
```

---

## ⏱ 4. Live Workout Tracker (`/workouts`)

### `POST /api/v1/workouts`
* **Security**: `BearerAuth`
* **Description**: Initializes a live workout session. When `routine_id` is supplied, pre-populates exercises and target sets.

**Request Body:**
```json
{
  "routine_id": "8a52932c-3965-4f4d-8067-17eb108e454f",
  "name": "Jeff Nippard PPL: Push 1"
}
```

### `GET /api/v1/workouts/active`
* **Security**: `BearerAuth`
* **Description**: Retrieves the currently in-progress active workout session.

### `POST /api/v1/workouts/active/exercises/{exerciseId}/sets`
* **Security**: `BearerAuth`
* **Description**: Logs a completed or pending set. Automatically computes Estimated 1RM (E1RM).

**Request Body:**
```json
{
  "set_number": 1,
  "set_type": "normal",
  "weight_kg": 100.0,
  "reps": 10,
  "rpe": 8.5,
  "completed": true
}
```

### `POST /api/v1/workouts/active/finish`
* **Security**: `BearerAuth`
* **Description**: Finalizes workout, calculates total volume and duration, updates PRs, and publishes `WorkoutFinished` domain event to NATS.

**Response (`200 OK`):**
```json
{
  "id": "e0e84b8d-6915-4c07-b39b-87178c7baea1",
  "name": "Jeff Nippard PPL: Push 1",
  "duration_seconds": 3840,
  "total_volume_kg": 16420.0,
  "completed_sets_count": 22,
  "pr_count": 2
}
```

---

## 📊 5. Progress, Analytics & Calendar (`/progress`)

### `GET /api/v1/progress/summary`
* **Security**: `BearerAuth`
* **Description**: Lifetime metrics (total tonnage lifted, workouts completed, PR count, training hours).

### `GET /api/v1/progress/records`
* **Security**: `BearerAuth`
* **Description**: Personal Records (PRs) Hall of Fame grouped by exercise:
  * 🥇 *Heaviest Weight Lifted*
  * 🚀 *Best Estimated 1RM*
  * ⚡ *Max Volume in Single Set*
  * 🔁 *Max Repetitions Set*

### `GET /api/v1/progress/volume-history`
* **Security**: `BearerAuth`
* **Description**: Time-series volume load data points for progression charts.

---

## ⚖️ 6. Body & Health Calculator (`/body`)

### `GET /api/v1/body/measurements`
* **Security**: `BearerAuth`
* **Description**: Returns latest bodyweight, height, automatic BMI classification, body fat %, and TDEE calorie calculation.

### `POST /api/v1/body/measurements`
* **Security**: `BearerAuth`
* **Description**: Logs new bodyweight/height entry with instant BMI & TDEE computation.

**Request Body:**
```json
{
  "weight_kg": 80.5,
  "height_cm": 182.0,
  "body_fat_percentage": 14.5,
  "notes": "Morning fast weigh-in"
}
```

---

## 🦾 7. AI Strength Coach (`/coach`)

### `GET /api/v1/coach/insights`
* **Security**: `BearerAuth`
* **Description**: Returns real-time CNS readiness score (0–100), recovery status, progressive overload prescriptions (+2.5 kg / reps), and plateau warnings.

### `POST /api/v1/coach/chat`
* **Security**: `BearerAuth`
* **Description**: Real-time sports science chat with workout history and PR context.

**Request Body:**
```json
{
  "message": "What is the optimal rest interval between heavy squat sets?",
  "history": []
}
```

**Response (`200 OK`):**
```json
{
  "reply": "For heavy compound lifts (>80% 1RM), 3–5 minutes rest allows full ATP-CP recovery and maximum power output across all working sets.",
  "suggestions": [
    "How does rest time affect hypertrophy?",
    "When should I introduce drop sets?"
  ]
}
```

---

## 🚨 Error Format (RFC 7807 Problem Details)

All error responses return standardized `application/problem+json`:

```json
{
  "type": "https://neverpaid.health/errors/not-found",
  "title": "Entity Not Found",
  "status": 404,
  "detail": "The requested workout session was not found.",
  "code": "ERR_WORKOUT_NOT_FOUND"
}
```
