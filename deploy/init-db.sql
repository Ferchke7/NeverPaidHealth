-- ==========================================================
-- NeverPaidHealth: Complete PostgreSQL Initialization Script
-- Creates all isolated databases, tables, indexes & seed data
-- ==========================================================

-- 1. Identity Database
CREATE DATABASE identity_db;
\c identity_db

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    google_sub VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    unit_preference VARCHAR(10) NOT NULL DEFAULT 'kg',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- 2. Exercise Database
CREATE DATABASE exercise_db;
\c exercise_db

CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    primary_muscle_group VARCHAR(50) NOT NULL,
    secondary_muscle_groups TEXT[] NOT NULL DEFAULT '{}',
    equipment VARCHAR(50) NOT NULL,
    measurement_type VARCHAR(50) NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_custom_user ON exercises(created_by_user_id) WHERE is_custom = TRUE;

-- Seed comprehensive standard exercises library
INSERT INTO exercises (id, name, primary_muscle_group, secondary_muscle_groups, equipment, measurement_type, is_custom, created_by_user_id) VALUES
-- Chest
('10000000-0000-0000-0000-000000000001', 'Barbell Bench Press', 'chest', '{"triceps", "shoulders"}', 'barbell', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000002', 'Incline Barbell Bench Press', 'chest', '{"shoulders", "triceps"}', 'barbell', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000003', 'Decline Barbell Bench Press', 'chest', '{"triceps"}', 'barbell', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000004', 'Dumbbell Bench Press', 'chest', '{"triceps", "shoulders"}', 'dumbbell', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000005', 'Incline Dumbbell Press', 'chest', '{"shoulders", "triceps"}', 'dumbbell', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000006', 'Dumbbell Fly', 'chest', '{}', 'dumbbell', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000007', 'Cable Crossover', 'chest', '{}', 'cable', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000008', 'Chest Dip', 'chest', '{"triceps", "shoulders"}', 'bodyweight', 'bodyweight_reps', false, null),
('10000000-0000-0000-0000-000000000009', 'Push Up', 'chest', '{"triceps", "core"}', 'bodyweight', 'bodyweight_reps', false, null),
('10000000-0000-0000-0000-000000000010', 'Machine Chest Press', 'chest', '{"triceps"}', 'machine', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000011', 'Pec Deck Fly', 'chest', '{}', 'machine', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000012', 'Smith Machine Bench Press', 'chest', '{"triceps"}', 'smith_machine', 'weight_reps', false, null),
('10000000-0000-0000-0000-000000000013', 'Upper Chest Crossover', 'chest', '{"shoulders"}', 'cable', 'weight_reps', false, null),

-- Back
('20000000-0000-0000-0000-000000000001', 'Deadlift', 'back', '{"hamstrings", "core", "quads"}', 'barbell', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000002', 'Barbell Bent Over Row', 'back', '{"biceps"}', 'barbell', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000003', 'Pull Up', 'back', '{"biceps"}', 'bodyweight', 'bodyweight_reps', false, null),
('20000000-0000-0000-0000-000000000004', 'Chin Up', 'back', '{"biceps"}', 'bodyweight', 'bodyweight_reps', false, null),
('20000000-0000-0000-0000-000000000005', 'Lat Pulldown', 'back', '{"biceps"}', 'cable', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000006', 'Seated Cable Row', 'back', '{"biceps"}', 'cable', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000007', 'One-Arm Dumbbell Row', 'back', '{"biceps"}', 'dumbbell', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000008', 'T-Bar Row', 'back', '{"biceps"}', 'barbell', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000009', 'Face Pull', 'back', '{"shoulders"}', 'cable', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000010', 'Hyperextension', 'back', '{"hamstrings"}', 'bodyweight', 'bodyweight_reps', false, null),
('20000000-0000-0000-0000-000000000011', 'Weighted Pull Up', 'back', '{"biceps"}', 'bodyweight', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000012', 'Cable Seated Row', 'back', '{"biceps"}', 'cable', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000013', 'Cable Lat Pulldown', 'back', '{"biceps"}', 'cable', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000014', 'Reverse Lat Pulldown', 'back', '{"biceps"}', 'cable', 'weight_reps', false, null),
('20000000-0000-0000-0000-000000000015', 'Kneeling Cable Pullover', 'back', '{"triceps"}', 'cable', 'weight_reps', false, null),

-- Quads & Legs
('30000000-0000-0000-0000-000000000001', 'Barbell Squat', 'quads', '{"hamstrings", "core"}', 'barbell', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000002', 'Front Squat', 'quads', '{"core"}', 'barbell', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000003', 'Leg Press', 'quads', '{"hamstrings"}', 'machine', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000004', 'Leg Extension', 'quads', '{}', 'machine', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000005', 'Bulgarian Split Squat', 'quads', '{"hamstrings"}', 'dumbbell', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000006', 'Walking Lunge', 'quads', '{"hamstrings"}', 'dumbbell', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000007', 'Hack Squat', 'quads', '{}', 'machine', 'weight_reps', false, null),
('30000000-0000-0000-0000-000000000008', 'Goblet Squat', 'quads', '{"core"}', 'kettlebell', 'weight_reps', false, null),

-- Hamstrings & Glutes
('40000000-0000-0000-0000-000000000001', 'Romanian Deadlift', 'hamstrings', '{"back"}', 'barbell', 'weight_reps', false, null),
('40000000-0000-0000-0000-000000000002', 'Dumbbell Romanian Deadlift', 'hamstrings', '{"back"}', 'dumbbell', 'weight_reps', false, null),
('40000000-0000-0000-0000-000000000003', 'Lying Leg Curl', 'hamstrings', '{}', 'machine', 'weight_reps', false, null),
('40000000-0000-0000-0000-000000000004', 'Seated Leg Curl', 'hamstrings', '{}', 'machine', 'weight_reps', false, null),
('40000000-0000-0000-0000-000000000005', 'Barbell Hip Thrust', 'hamstrings', '{}', 'barbell', 'weight_reps', false, null),
('40000000-0000-0000-0000-000000000006', 'Hip Thrust', 'hamstrings', '{}', 'barbell', 'weight_reps', false, null),

-- Shoulders
('50000000-0000-0000-0000-000000000001', 'Overhead Press', 'shoulders', '{"triceps", "core"}', 'barbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000002', 'Seated Dumbbell Shoulder Press', 'shoulders', '{"triceps"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000003', 'Dumbbell Lateral Raise', 'shoulders', '{}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000004', 'Cable Lateral Raise', 'shoulders', '{}', 'cable', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000005', 'Rear Delt Fly', 'shoulders', '{"back"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000006', 'Arnold Press', 'shoulders', '{"triceps"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000007', 'Upright Row', 'shoulders', '{"back"}', 'barbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000008', 'Military Press', 'shoulders', '{"triceps"}', 'barbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000009', 'Reverse Fly', 'shoulders', '{"back"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000010', 'Lateral Raise', 'shoulders', '{}', 'dumbbell', 'weight_reps', false, null),

-- Biceps
('60000000-0000-0000-0000-000000000001', 'Barbell Bicep Curl', 'biceps', '{}', 'barbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000002', 'Dumbbell Bicep Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000003', 'Hammer Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000004', 'Incline Dumbbell Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000005', 'Preacher Curl', 'biceps', '{}', 'barbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000006', 'Cable Bicep Curl', 'biceps', '{}', 'cable', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000007', 'EZ Bar Curl', 'biceps', '{}', 'barbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000008', 'Reverse Curl', 'biceps', '{}', 'barbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000009', 'Incline Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),

-- Triceps
('70000000-0000-0000-0000-000000000001', 'Tricep Pushdown', 'triceps', '{}', 'cable', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000002', 'Skull Crusher', 'triceps', '{}', 'barbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000003', 'Overhead Tricep Extension', 'triceps', '{}', 'dumbbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000004', 'Close-Grip Bench Press', 'triceps', '{"chest"}', 'barbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000005', 'Tricep Dip', 'triceps', '{"chest"}', 'bodyweight', 'bodyweight_reps', false, null),
('70000000-0000-0000-0000-000000000006', 'Dip', 'triceps', '{"chest"}', 'bodyweight', 'bodyweight_reps', false, null),
('70000000-0000-0000-0000-000000000007', 'EZ Bar Tricep Extension', 'triceps', '{}', 'barbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000008', 'Cable Tricep Kickback', 'triceps', '{}', 'cable', 'weight_reps', false, null),

-- Core
('80000000-0000-0000-0000-000000000001', 'Plank', 'core', '{}', 'bodyweight', 'duration', false, null),
('80000000-0000-0000-0000-000000000002', 'Hanging Leg Raise', 'core', '{}', 'bodyweight', 'bodyweight_reps', false, null),
('80000000-0000-0000-0000-000000000003', 'Cable Crunch', 'core', '{}', 'cable', 'weight_reps', false, null),
('80000000-0000-0000-0000-000000000004', 'Ab Wheel Rollout', 'core', '{}', 'bodyweight', 'bodyweight_reps', false, null),
('80000000-0000-0000-0000-000000000005', 'Hanging Knee Raise', 'core', '{}', 'bodyweight', 'bodyweight_reps', false, null),
('80000000-0000-0000-0000-000000000006', 'Decline Crunch', 'core', '{}', 'bodyweight', 'bodyweight_reps', false, null),

-- Calves
('90000000-0000-0000-0000-000000000001', 'Standing Calf Raise', 'calves', '{}', 'machine', 'weight_reps', false, null),
('90000000-0000-0000-0000-000000000002', 'Seated Calf Raise', 'calves', '{}', 'machine', 'weight_reps', false, null),
('90000000-0000-0000-0000-000000000003', 'Calf Raise', 'calves', '{}', 'machine', 'weight_reps', false, null)
ON CONFLICT (id) DO NOTHING;


-- 3. Training Database
CREATE DATABASE training_db;
\c training_db

CREATE TABLE IF NOT EXISTS routines (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    notes TEXT,
    exercises JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);

CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    routine_id UUID,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    exercises JSONB NOT NULL DEFAULT '[]',
    total_volume_kg NUMERIC(10, 2),
    completed_sets_count INT,
    duration_seconds INT
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_status ON workouts(user_id, status);

CREATE TABLE IF NOT EXISTS outbox (
    id UUID PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(created_at) WHERE published_at IS NULL;

-- Seed Standard Routines Library (Jeff Nippard 6-Day PPL - Exact Jefit Spec)
INSERT INTO routines (id, user_id, name, notes, exercises, created_at, updated_at) VALUES
('e1111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000000', 'Jeff Nippard PPL: Push 1 (Chest Focus)', 'Chest emphasis with secondary shoulder and triceps hypertrophy.', '[{"exercise_id": "10000000-0000-0000-0000-000000000004", "exercise_name": "Dumbbell Bench Press", "order_index": 0, "target_sets": 4, "target_reps_min": 8, "target_reps_max": 8}, {"exercise_id": "50000000-0000-0000-0000-000000000006", "exercise_name": "Dumbbell Seated Arnold Press", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "70000000-0000-0000-0000-000000000006", "exercise_name": "Dip", "order_index": 2, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15}, {"exercise_id": "70000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Tricep Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}, {"exercise_id": "50000000-0000-0000-0000-000000000004", "exercise_name": "Cable One-Arm Lateral Raise", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "70000000-0000-0000-0000-000000000008", "exercise_name": "Cable Tricep Kickback", "order_index": 5, "target_sets": 3, "target_reps_min": 25, "target_reps_max": 25}]'::jsonb, NOW(), NOW()),
('e1111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000000', 'Jeff Nippard PPL: Pull 1 (Lat Focus)', 'Lat width emphasis with bicep development.', '[{"exercise_id": "20000000-0000-0000-0000-000000000011", "exercise_name": "Weighted Pull-Up", "order_index": 0, "target_sets": 3, "target_reps_min": 6, "target_reps_max": 6}, {"exercise_id": "20000000-0000-0000-0000-000000000012", "exercise_name": "Cable Seated Row", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "20000000-0000-0000-0000-000000000015", "exercise_name": "Kneeling Cable Pullover", "order_index": 2, "target_sets": 3, "target_reps_min": 20, "target_reps_max": 20}, {"exercise_id": "60000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Alternating Hammer Curl", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}, {"exercise_id": "60000000-0000-0000-0000-000000000009", "exercise_name": "Dumbbell Incline Curl", "order_index": 4, "target_sets": 2, "target_reps_min": 15, "target_reps_max": 15}]'::jsonb, NOW(), NOW()),
('e1111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000000', 'Jeff Nippard PPL: Legs 1 (Posterior Chain Focus)', 'Deadlift, hamstrings, glutes, and core focus.', '[{"exercise_id": "20000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Deadlift", "order_index": 0, "target_sets": 3, "target_reps_min": 3, "target_reps_max": 3}, {"exercise_id": "30000000-0000-0000-0000-000000000008", "exercise_name": "Kettlebell Goblet Squat", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "40000000-0000-0000-0000-000000000006", "exercise_name": "Bench Hip Thrust", "order_index": 2, "target_sets": 2, "target_reps_min": 15, "target_reps_max": 15}, {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Machine Seated Leg Curl", "order_index": 3, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "20000000-0000-0000-0000-000000000010", "exercise_name": "Back Hyperextension", "order_index": 4, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Calf Raise", "order_index": 5, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "80000000-0000-0000-0000-000000000005", "exercise_name": "Weighted Hanging Knee Raise", "order_index": 6, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}]'::jsonb, NOW(), NOW()),
('e1111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000000', 'Jeff Nippard PPL: Push 2 (Shoulder Focus)', 'Overhead pressing and upper chest emphasis.', '[{"exercise_id": "50000000-0000-0000-0000-000000000008", "exercise_name": "Barbell Military Press", "order_index": 0, "target_sets": 4, "target_reps_min": 4, "target_reps_max": 4}, {"exercise_id": "70000000-0000-0000-0000-000000000004", "exercise_name": "Barbell Bench Press (Close Grip)", "order_index": 1, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}, {"exercise_id": "10000000-0000-0000-0000-000000000013", "exercise_name": "Cable Upper Chest Crossover", "order_index": 2, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "70000000-0000-0000-0000-000000000003", "exercise_name": "Cable Rope Overhead Tricep Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "50000000-0000-0000-0000-000000000010", "exercise_name": "Dumbbell Lateral Raise", "order_index": 4, "target_sets": 3, "target_reps_min": 21, "target_reps_max": 21}]'::jsonb, NOW(), NOW()),
('e1111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000000', 'Jeff Nippard PPL: Pull 2 (Mid-Back Focus)', 'Thickness, rhomboids, rear delts, and arm work.', '[{"exercise_id": "20000000-0000-0000-0000-000000000005", "exercise_name": "Cable Lat Pulldown (Wide Grip)", "order_index": 0, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "20000000-0000-0000-0000-000000000014", "exercise_name": "Machine Reverse Lat Pulldown (Close Grip)", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "20000000-0000-0000-0000-000000000008", "exercise_name": "T Bar Row", "order_index": 2, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "20000000-0000-0000-0000-000000000009", "exercise_name": "Cable Rope Face Pull", "order_index": 3, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15}, {"exercise_id": "50000000-0000-0000-0000-000000000009", "exercise_name": "Machine Reverse Fly", "order_index": 4, "target_sets": 2, "target_reps_min": 8, "target_reps_max": 8}, {"exercise_id": "60000000-0000-0000-0000-000000000008", "exercise_name": "EZ Bar Curl (Reverse Grip)", "order_index": 5, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}, {"exercise_id": "60000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Curl", "order_index": 6, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}]'::jsonb, NOW(), NOW()),
('e1111111-1111-1111-1111-111111111106', '00000000-0000-0000-0000-000000000000', 'Jeff Nippard PPL: Legs 2 (Quads Focus)', 'Heavy barbell squatting and quad development.', '[{"exercise_id": "30000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Squat", "order_index": 0, "target_sets": 3, "target_reps_min": 4, "target_reps_max": 4}, {"exercise_id": "40000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Romanian Deadlift", "order_index": 1, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}, {"exercise_id": "30000000-0000-0000-0000-000000000003", "exercise_name": "Machine Leg Press", "order_index": 2, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15}, {"exercise_id": "30000000-0000-0000-0000-000000000004", "exercise_name": "Machine Leg Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Machine Seated Leg Curl", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Calf Raise", "order_index": 5, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}, {"exercise_id": "80000000-0000-0000-0000-000000000006", "exercise_name": "Bench Weighted Decline Crunch", "order_index": 6, "target_sets": 2, "target_reps_min": 10, "target_reps_max": 10}, {"exercise_id": "80000000-0000-0000-0000-000000000001", "exercise_name": "Plank", "order_index": 7, "target_sets": 2, "target_reps_min": 60, "target_reps_max": 60}]'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  notes = EXCLUDED.notes,
  exercises = EXCLUDED.exercises,
  updated_at = NOW();


-- 4. Progress Database
CREATE DATABASE progress_db;
\c progress_db

CREATE TABLE IF NOT EXISTS record_books (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    exercise_name VARCHAR(100) NOT NULL,
    best_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    best_e1rm_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_volume_set_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_reps INT NOT NULL DEFAULT 0,
    records JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_record_books_user ON record_books(user_id);

CREATE TABLE IF NOT EXISTS exercise_history (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    exercise_name VARCHAR(100) NOT NULL,
    workout_id UUID NOT NULL,
    log_date TIMESTAMPTZ NOT NULL,
    best_weight_kg NUMERIC(10, 2) NOT NULL,
    best_e1rm_kg NUMERIC(10, 2),
    total_exercise_volume_kg NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_history_series ON exercise_history(user_id, exercise_id, log_date ASC);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 5. Body Database
CREATE DATABASE body_db;
\c body_db

CREATE TABLE IF NOT EXISTS body_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    log_date VARCHAR(10) NOT NULL,
    weight_grams BIGINT NOT NULL,
    body_fat_percentage NUMERIC(4, 1),
    waist_cm NUMERIC(5, 1),
    chest_cm NUMERIC(5, 1),
    arms_cm NUMERIC(5, 1),
    thighs_cm NUMERIC(5, 1),
    calves_cm NUMERIC(5, 1),
    neck_cm NUMERIC(5, 1),
    calculated_bmi NUMERIC(4, 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_body_logs_user_date ON body_logs(user_id, log_date ASC);

-- 6. Todo & Schedule Calendar Database
CREATE DATABASE todo_db;
\c todo_db

CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'work',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    event_type VARCHAR(50) NOT NULL DEFAULT 'task',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    target_duration_minutes INT NOT NULL DEFAULT 30,
    total_spent_minutes INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    meeting_url VARCHAR(500),
    external_calendar_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_date ON todos(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(user_id, status);

CREATE TABLE IF NOT EXISTS todo_activity_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
    task_title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    session_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON todo_activity_logs(user_id, started_at DESC);

