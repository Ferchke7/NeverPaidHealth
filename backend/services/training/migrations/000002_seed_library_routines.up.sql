-- Comprehensive Routine Templates Library

INSERT INTO routines (id, user_id, name, notes, exercises, created_at, updated_at) VALUES
-- 1. Jeff Nippard Push 1
(
  'e1111111-1111-1111-1111-111111111101',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard PPL: Push 1 (Chest Focus)',
  'Chest emphasis with secondary shoulder and triceps hypertrophy.',
  '[
    {"exercise_id": "10000000-0000-0000-0000-000000000004", "exercise_name": "Dumbbell Bench Press", "order_index": 0, "target_sets": 4, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "50000000-0000-0000-0000-000000000006", "exercise_name": "Arnold Press", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "70000000-0000-0000-0000-000000000006", "exercise_name": "Dip", "order_index": 2, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "70000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Tricep Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "50000000-0000-0000-0000-000000000004", "exercise_name": "Cable Lateral Raise", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15},
    {"exercise_id": "70000000-0000-0000-0000-000000000008", "exercise_name": "Cable Tricep Kickback", "order_index": 5, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15}
  ]'::jsonb,
  NOW(),
  NOW()
),
-- 2. Jeff Nippard Pull 1
(
  'e1111111-1111-1111-1111-111111111102',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard PPL: Pull 1 (Lat Focus)',
  'Lat width emphasis with bicep development.',
  '[
    {"exercise_id": "20000000-0000-0000-0000-000000000011", "exercise_name": "Weighted Pull Up", "order_index": 0, "target_sets": 3, "target_reps_min": 6, "target_reps_max": 10},
    {"exercise_id": "20000000-0000-0000-0000-000000000012", "exercise_name": "Cable Seated Row", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "20000000-0000-0000-0000-000000000015", "exercise_name": "Kneeling Cable Pullover", "order_index": 2, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 20},
    {"exercise_id": "60000000-0000-0000-0000-000000000003", "exercise_name": "Hammer Curl", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "60000000-0000-0000-0000-000000000009", "exercise_name": "Incline Curl", "order_index": 4, "target_sets": 2, "target_reps_min": 10, "target_reps_max": 15}
  ]'::jsonb,
  NOW(),
  NOW()
),
-- 3. Jeff Nippard Legs 1
(
  'e1111111-1111-1111-1111-111111111103',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard PPL: Legs 1 (Posterior Chain)',
  'Deadlift, hamstrings, glutes, and core focus.',
  '[
    {"exercise_id": "20000000-0000-0000-0000-000000000001", "exercise_name": "Deadlift", "order_index": 0, "target_sets": 3, "target_reps_min": 5, "target_reps_max": 8},
    {"exercise_id": "30000000-0000-0000-0000-000000000008", "exercise_name": "Goblet Squat", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "40000000-0000-0000-0000-000000000006", "exercise_name": "Hip Thrust", "order_index": 2, "target_sets": 2, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Seated Leg Curl", "order_index": 3, "target_sets": 2, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "20000000-0000-0000-0000-000000000010", "exercise_name": "Hyperextension", "order_index": 4, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 15},
    {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Calf Raise", "order_index": 5, "target_sets": 2, "target_reps_min": 15, "target_reps_max": 20},
    {"exercise_id": "80000000-0000-0000-0000-000000000005", "exercise_name": "Hanging Knee Raise", "order_index": 6, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15}
  ]'::jsonb,
  NOW(),
  NOW()
),
-- 4. Jeff Nippard Push 2
(
  'e1111111-1111-1111-1111-111111111104',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard PPL: Push 2 (Shoulder Focus)',
  'Overhead pressing and upper chest emphasis.',
  '[
    {"exercise_id": "50000000-0000-0000-0000-000000000008", "exercise_name": "Military Press", "order_index": 0, "target_sets": 4, "target_reps_min": 6, "target_reps_max": 10},
    {"exercise_id": "70000000-0000-0000-0000-000000000004", "exercise_name": "Close-Grip Bench Press", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "10000000-0000-0000-0000-000000000013", "exercise_name": "Upper Chest Crossover", "order_index": 2, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 15},
    {"exercise_id": "70000000-0000-0000-0000-000000000003", "exercise_name": "Overhead Tricep Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "50000000-0000-0000-0000-000000000010", "exercise_name": "Lateral Raise", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15}
  ]'::jsonb,
  NOW(),
  NOW()
),
-- 5. Jeff Nippard Pull 2
(
  'e1111111-1111-1111-1111-111111111105',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard PPL: Pull 2 (Mid-Back Focus)',
  'Thickness, rhomboids, rear delts, and arm work.',
  '[
    {"exercise_id": "20000000-0000-0000-0000-000000000005", "exercise_name": "Lat Pulldown", "order_index": 0, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "20000000-0000-0000-0000-000000000008", "exercise_name": "T-Bar Row", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "20000000-0000-0000-0000-000000000014", "exercise_name": "Reverse Lat Pulldown", "order_index": 2, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "20000000-0000-0000-0000-000000000009", "exercise_name": "Face Pull", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15},
    {"exercise_id": "50000000-0000-0000-0000-000000000009", "exercise_name": "Reverse Fly", "order_index": 4, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 15},
    {"exercise_id": "60000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Curl", "order_index": 5, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "60000000-0000-0000-0000-000000000008", "exercise_name": "Reverse Curl", "order_index": 6, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12}
  ]'::jsonb,
  NOW(),
  NOW()
),
-- 6. Jeff Nippard Legs 2
(
  'e1111111-1111-1111-1111-111111111106',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard PPL: Legs 2 (Quads Focus)',
  'Heavy barbell squatting and quad development.',
  '[
    {"exercise_id": "30000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Squat", "order_index": 0, "target_sets": 3, "target_reps_min": 6, "target_reps_max": 10},
    {"exercise_id": "40000000-0000-0000-0000-000000000001", "exercise_name": "Romanian Deadlift", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 12},
    {"exercise_id": "30000000-0000-0000-0000-000000000003", "exercise_name": "Leg Press", "order_index": 2, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "30000000-0000-0000-0000-000000000004", "exercise_name": "Leg Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 15},
    {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Seated Leg Curl", "order_index": 4, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
    {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Calf Raise", "order_index": 5, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 20},
    {"exercise_id": "80000000-0000-0000-0000-000000000006", "exercise_name": "Decline Crunch", "order_index": 6, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 15},
    {"exercise_id": "80000000-0000-0000-0000-000000000001", "exercise_name": "Plank", "order_index": 7, "target_sets": 2, "target_reps_min": 60, "target_reps_max": 60}
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  notes = EXCLUDED.notes,
  exercises = EXCLUDED.exercises,
  updated_at = NOW();
