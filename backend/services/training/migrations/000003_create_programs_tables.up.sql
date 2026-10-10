-- Programs and Multi-Day Training Splits Table

CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    split_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    days_per_week INT NOT NULL DEFAULT 3,
    level VARCHAR(50) NOT NULL DEFAULT 'intermediate',
    is_public BOOLEAN NOT NULL DEFAULT false,
    author_name VARCHAR(100),
    likes_count INT NOT NULL DEFAULT 0,
    installs_count INT NOT NULL DEFAULT 0,
    days JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_user_id ON programs(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_is_public ON programs(is_public);
CREATE INDEX IF NOT EXISTS idx_programs_split_type ON programs(split_type);

-- User Installed Programs & Active Program Selection
CREATE TABLE IF NOT EXISTS user_programs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    custom_name VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT false,
    current_day_index INT NOT NULL DEFAULT 0,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_programs_user_id ON user_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_active ON user_programs(user_id, is_active);

-- Seed Official System Programs (user_id = '00000000-0000-0000-0000-000000000000')

INSERT INTO programs (id, user_id, name, description, split_type, days_per_week, level, is_public, author_name, likes_count, installs_count, days, created_at, updated_at)
VALUES
(
  'p1111111-1111-1111-1111-111111111101',
  '00000000-0000-0000-0000-000000000000',
  'Jeff Nippard: 6-Day Push / Pull / Legs Split',
  'Official 6-day science-based hypertrophy split designed by Jeff Nippard. Features push/pull/legs frequency with dedicated chest, shoulder, lat, and quad focus days.',
  'ppl',
  6,
  'advanced',
  true,
  'Jeff Nippard',
  482,
  1250,
  '[
    {
      "day_number": 1,
      "name": "Push 1 (Chest Focus)",
      "notes": "Chest emphasis with secondary shoulder and triceps hypertrophy.",
      "exercises": [
        {"exercise_id": "10000000-0000-0000-0000-000000000004", "exercise_name": "Dumbbell Bench Press", "order_index": 0, "target_sets": 4, "target_reps_min": 8, "target_reps_max": 8},
        {"exercise_id": "50000000-0000-0000-0000-000000000006", "exercise_name": "Dumbbell Seated Arnold Press", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "70000000-0000-0000-0000-000000000006", "exercise_name": "Dip", "order_index": 2, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15},
        {"exercise_id": "70000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Tricep Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10},
        {"exercise_id": "50000000-0000-0000-0000-000000000004", "exercise_name": "Cable One-Arm Lateral Raise", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "70000000-0000-0000-0000-000000000008", "exercise_name": "Cable Tricep Kickback", "order_index": 5, "target_sets": 3, "target_reps_min": 25, "target_reps_max": 25}
      ]
    },
    {
      "day_number": 2,
      "name": "Pull 1 (Lat Focus)",
      "notes": "Lat width emphasis with bicep development.",
      "exercises": [
        {"exercise_id": "20000000-0000-0000-0000-000000000011", "exercise_name": "Weighted Pull-Up", "order_index": 0, "target_sets": 3, "target_reps_min": 6, "target_reps_max": 6},
        {"exercise_id": "20000000-0000-0000-0000-000000000012", "exercise_name": "Cable Seated Row", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "20000000-0000-0000-0000-000000000015", "exercise_name": "Kneeling Cable Pullover", "order_index": 2, "target_sets": 3, "target_reps_min": 20, "target_reps_max": 20},
        {"exercise_id": "60000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Alternating Hammer Curl", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10},
        {"exercise_id": "60000000-0000-0000-0000-000000000009", "exercise_name": "Dumbbell Incline Curl", "order_index": 4, "target_sets": 2, "target_reps_min": 15, "target_reps_max": 15}
      ]
    },
    {
      "day_number": 3,
      "name": "Legs 1 (Posterior Chain Focus)",
      "notes": "Deadlift, hamstrings, glutes, and core focus.",
      "exercises": [
        {"exercise_id": "20000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Deadlift", "order_index": 0, "target_sets": 3, "target_reps_min": 3, "target_reps_max": 3},
        {"exercise_id": "30000000-0000-0000-0000-000000000008", "exercise_name": "Kettlebell Goblet Squat", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "40000000-0000-0000-0000-000000000006", "exercise_name": "Bench Hip Thrust", "order_index": 2, "target_sets": 2, "target_reps_min": 15, "target_reps_max": 15},
        {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Machine Seated Leg Curl", "order_index": 3, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "20000000-0000-0000-0000-000000000010", "exercise_name": "Back Hyperextension", "order_index": 4, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Calf Raise", "order_index": 5, "target_sets": 2, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "80000000-0000-0000-0000-000000000005", "exercise_name": "Weighted Hanging Knee Raise", "order_index": 6, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12}
      ]
    },
    {
      "day_number": 4,
      "name": "Push 2 (Shoulder Focus)",
      "notes": "Overhead pressing and upper chest emphasis.",
      "exercises": [
        {"exercise_id": "50000000-0000-0000-0000-000000000008", "exercise_name": "Barbell Military Press", "order_index": 0, "target_sets": 4, "target_reps_min": 4, "target_reps_max": 4},
        {"exercise_id": "70000000-0000-0000-0000-000000000004", "exercise_name": "Barbell Bench Press (Close Grip)", "order_index": 1, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10},
        {"exercise_id": "10000000-0000-0000-0000-000000000013", "exercise_name": "Cable Upper Chest Crossover", "order_index": 2, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "70000000-0000-0000-0000-000000000003", "exercise_name": "Cable Rope Overhead Tricep Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "50000000-0000-0000-0000-000000000010", "exercise_name": "Dumbbell Lateral Raise", "order_index": 4, "target_sets": 3, "target_reps_min": 21, "target_reps_max": 21}
      ]
    },
    {
      "day_number": 5,
      "name": "Pull 2 (Mid-Back Focus)",
      "notes": "Thickness, rhomboids, rear delts, and arm work.",
      "exercises": [
        {"exercise_id": "20000000-0000-0000-0000-000000000005", "exercise_name": "Cable Lat Pulldown (Wide Grip)", "order_index": 0, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "20000000-0000-0000-0000-000000000014", "exercise_name": "Machine Reverse Lat Pulldown (Close Grip)", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "20000000-0000-0000-0000-000000000008", "exercise_name": "T Bar Row", "order_index": 2, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "20000000-0000-0000-0000-000000000009", "exercise_name": "Cable Rope Face Pull", "order_index": 3, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15},
        {"exercise_id": "50000000-0000-0000-0000-000000000009", "exercise_name": "Machine Reverse Fly", "order_index": 4, "target_sets": 2, "target_reps_min": 8, "target_reps_max": 8},
        {"exercise_id": "60000000-0000-0000-0000-000000000008", "exercise_name": "EZ Bar Curl (Reverse Grip)", "order_index": 5, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10},
        {"exercise_id": "60000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Curl", "order_index": 6, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10}
      ]
    },
    {
      "day_number": 6,
      "name": "Legs 2 (Quads Focus)",
      "notes": "Heavy barbell squatting and quad development.",
      "exercises": [
        {"exercise_id": "30000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Squat", "order_index": 0, "target_sets": 3, "target_reps_min": 4, "target_reps_max": 4},
        {"exercise_id": "40000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Romanian Deadlift", "order_index": 1, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 10},
        {"exercise_id": "30000000-0000-0000-0000-000000000003", "exercise_name": "Machine Leg Press", "order_index": 2, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15},
        {"exercise_id": "30000000-0000-0000-0000-000000000004", "exercise_name": "Machine Leg Extension", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Machine Seated Leg Curl", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Calf Raise", "order_index": 5, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "80000000-0000-0000-0000-000000000006", "exercise_name": "Bench Weighted Decline Crunch", "order_index": 6, "target_sets": 2, "target_reps_min": 10, "target_reps_max": 10},
        {"exercise_id": "80000000-0000-0000-0000-000000000001", "exercise_name": "Plank", "order_index": 7, "target_sets": 2, "target_reps_min": 60, "target_reps_max": 60}
      ]
    }
  ]'::jsonb,
  NOW(),
  NOW()
),
(
  'p1111111-1111-1111-1111-111111111102',
  '00000000-0000-0000-0000-000000000000',
  'Upper / Lower 4-Day Hypertrophy Split',
  'The gold standard 4-day split balancing frequency, systemic recovery, and heavy compound progression.',
  'upper_lower',
  4,
  'intermediate',
  true,
  'Duda Science Team',
  318,
  890,
  '[
    {
      "day_number": 1,
      "name": "Upper Body A (Strength Focus)",
      "notes": "Heavy horizontal bench and rows followed by overhead and arms.",
      "exercises": [
        {"exercise_id": "10000000-0000-0000-0000-000000000004", "exercise_name": "Dumbbell Bench Press", "order_index": 0, "target_sets": 4, "target_reps_min": 6, "target_reps_max": 8},
        {"exercise_id": "20000000-0000-0000-0000-000000000008", "exercise_name": "T Bar Row", "order_index": 1, "target_sets": 4, "target_reps_min": 8, "target_reps_max": 10},
        {"exercise_id": "50000000-0000-0000-0000-000000000008", "exercise_name": "Barbell Military Press", "order_index": 2, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 10},
        {"exercise_id": "60000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Curl", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
        {"exercise_id": "70000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Tricep Extension", "order_index": 4, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12}
      ]
    },
    {
      "day_number": 2,
      "name": "Lower Body A (Quad & Squat Focus)",
      "notes": "Primary knee flexion and heavy back squatting.",
      "exercises": [
        {"exercise_id": "30000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Squat", "order_index": 0, "target_sets": 4, "target_reps_min": 5, "target_reps_max": 6},
        {"exercise_id": "40000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Romanian Deadlift", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 10},
        {"exercise_id": "30000000-0000-0000-0000-000000000003", "exercise_name": "Machine Leg Press", "order_index": 2, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15},
        {"exercise_id": "90000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Calf Raise", "order_index": 3, "target_sets": 4, "target_reps_min": 15, "target_reps_max": 15}
      ]
    },
    {
      "day_number": 3,
      "name": "Upper Body B (Hypertrophy & Incline)",
      "notes": "Incline pressing, vertical pulldowns, lateral raises and pump.",
      "exercises": [
        {"exercise_id": "10000000-0000-0000-0000-000000000013", "exercise_name": "Cable Upper Chest Crossover", "order_index": 0, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15},
        {"exercise_id": "20000000-0000-0000-0000-000000000005", "exercise_name": "Cable Lat Pulldown (Wide Grip)", "order_index": 1, "target_sets": 4, "target_reps_min": 10, "target_reps_max": 12},
        {"exercise_id": "50000000-0000-0000-0000-000000000010", "exercise_name": "Dumbbell Lateral Raise", "order_index": 2, "target_sets": 4, "target_reps_min": 15, "target_reps_max": 20},
        {"exercise_id": "60000000-0000-0000-0000-000000000003", "exercise_name": "Dumbbell Alternating Hammer Curl", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "70000000-0000-0000-0000-000000000003", "exercise_name": "Cable Rope Overhead Tricep Extension", "order_index": 4, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15}
      ]
    },
    {
      "day_number": 4,
      "name": "Lower Body B (Deadlift & Posterior Chain)",
      "notes": "Heavy deadlifts, hip thrusts, hamstring isolation, and calves.",
      "exercises": [
        {"exercise_id": "20000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Deadlift", "order_index": 0, "target_sets": 3, "target_reps_min": 5, "target_reps_max": 5},
        {"exercise_id": "40000000-0000-0000-0000-000000000006", "exercise_name": "Bench Hip Thrust", "order_index": 1, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 12},
        {"exercise_id": "40000000-0000-0000-0000-000000000004", "exercise_name": "Machine Seated Leg Curl", "order_index": 2, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15},
        {"exercise_id": "80000000-0000-0000-0000-000000000005", "exercise_name": "Weighted Hanging Knee Raise", "order_index": 3, "target_sets": 3, "target_reps_min": 12, "target_reps_max": 15}
      ]
    }
  ]'::jsonb,
  NOW(),
  NOW()
),
(
  'p1111111-1111-1111-1111-111111111103',
  '00000000-0000-0000-0000-000000000000',
  'Full Body 3-Day Foundational Strength',
  'High-efficiency full body routine hitting all major movement patterns 3 times per week. Ideal for busy schedules and rapid baseline strength.',
  'full_body',
  3,
  'beginner',
  true,
  'Duda Strength Lab',
  245,
  620,
  '[
    {
      "day_number": 1,
      "name": "Full Body Day A",
      "notes": "Squat and horizontal press emphasis with posterior chain support.",
      "exercises": [
        {"exercise_id": "30000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Squat", "order_index": 0, "target_sets": 3, "target_reps_min": 5, "target_reps_max": 5},
        {"exercise_id": "10000000-0000-0000-0000-000000000004", "exercise_name": "Dumbbell Bench Press", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 8},
        {"exercise_id": "20000000-0000-0000-0000-000000000012", "exercise_name": "Cable Seated Row", "order_index": 2, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
        {"exercise_id": "50000000-0000-0000-0000-000000000010", "exercise_name": "Dumbbell Lateral Raise", "order_index": 3, "target_sets": 3, "target_reps_min": 15, "target_reps_max": 15}
      ]
    },
    {
      "day_number": 2,
      "name": "Full Body Day B",
      "notes": "Deadlift and vertical pull/press emphasis.",
      "exercises": [
        {"exercise_id": "20000000-0000-0000-0000-000000000001", "exercise_name": "Barbell Deadlift", "order_index": 0, "target_sets": 3, "target_reps_min": 5, "target_reps_max": 5},
        {"exercise_id": "50000000-0000-0000-0000-000000000008", "exercise_name": "Barbell Military Press", "order_index": 1, "target_sets": 3, "target_reps_min": 8, "target_reps_max": 8},
        {"exercise_id": "20000000-0000-0000-0000-000000000011", "exercise_name": "Weighted Pull-Up", "order_index": 2, "target_sets": 3, "target_reps_min": 6, "target_reps_max": 8},
        {"exercise_id": "60000000-0000-0000-0000-000000000007", "exercise_name": "EZ Bar Curl", "order_index": 3, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12}
      ]
    },
    {
      "day_number": 3,
      "name": "Full Body Day C",
      "notes": "Leg press, dips, pulldowns and core accessory work.",
      "exercises": [
        {"exercise_id": "30000000-0000-0000-0000-000000000003", "exercise_name": "Machine Leg Press", "order_index": 0, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
        {"exercise_id": "70000000-0000-0000-0000-000000000006", "exercise_name": "Dip", "order_index": 1, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
        {"exercise_id": "20000000-0000-0000-0000-000000000005", "exercise_name": "Cable Lat Pulldown (Wide Grip)", "order_index": 2, "target_sets": 3, "target_reps_min": 10, "target_reps_max": 12},
        {"exercise_id": "80000000-0000-0000-0000-000000000001", "exercise_name": "Plank", "order_index": 3, "target_sets": 3, "target_reps_min": 60, "target_reps_max": 60}
      ]
    }
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  split_type = EXCLUDED.split_type,
  days_per_week = EXCLUDED.days_per_week,
  level = EXCLUDED.level,
  is_public = EXCLUDED.is_public,
  author_name = EXCLUDED.author_name,
  days = EXCLUDED.days,
  updated_at = NOW();
