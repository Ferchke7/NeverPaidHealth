# Ubiquitous Language & Domain Glossary

This document serves as the **Single Source of Truth for Terminology** across all services, frontend code, database tables, and API contracts.

---

| Term | Category | Definition | Allowed Synonyms | Forbidden Terms (DO NOT USE) |
|---|---|---|---|---|
| **User** | Identity | An authenticated individual account using the platform. | Account, Profile | Member, Client |
| **UnitPreference** | Identity | The preferred measurement unit for the user (`kg` or `lb`). Stored in user profile. | Units | WeightSystem |
| **Exercise** | Exercise | A cataloged physical movement with defined target muscles and equipment. | Movement | Activity, Drill |
| **MuscleGroup** | Exercise | Primary anatomical target (Chest, Back, Quads, Hamstrings, Shoulders, Biceps, Triceps, Core, Calves, FullBody). | Muscle | BodyPart |
| **Equipment** | Exercise | The apparatus used for an exercise (Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, SmithMachine). | Gear | MachineType |
| **MeasurementType** | Exercise | How a set is measured: `weight_reps`, `bodyweight_reps`, `duration`, `distance_duration`. | MetricType | Modality |
| **Routine** | Training | A reusable template/plan containing a list of exercises with target rep ranges and sets. | Template, Plan | Split, WorkoutPlan |
| **Workout** | Training | An active or completed training session with timestamp, exercises, and logged sets. | Session | TrainingSession, GymLog |
| **WorkoutSet** | Training | A single completed or planned execution of an exercise within a workout. | Set | Entry, Log |
| **SetType** | Training | The classification of a set: `normal`, `warmup`, `drop`, `failure`. | — | WarmupFlag, Category |
| **Weight** | Domain | Mass lifted or body weight. Represented internally as integer **grams** to eliminate float rounding errors. | Load | Resistance |
| **Reps** | Domain | Repetition count (integer 1–200). | Repetitions | Count |
| **RPE** | Domain | Rate of Perceived Exertion (6.0–10.0 in increments of 0.5, or nil). | Effort | ExertionScale |
| **PersonalRecord (PR)** | Progress | An all-time strictly superior achievement across 4 dimensions: `heaviest_weight`, `best_e1rm`, `max_volume_set`, `max_reps`. | PR, PB, Record | HighScore, Achievement |
| **BodyLog** | Body | A single-day record of body weight, body fat %, and circumference measurements. | DailyLog | BodyMetric |
| **BodyFatPercentage** | Body | Body fat percentage (2.0%–70.0%). | BodyFat | Fat |
