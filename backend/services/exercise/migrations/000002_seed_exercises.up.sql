-- Seed comprehensive standard exercises library (~120 movements)

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

-- Shoulders
('50000000-0000-0000-0000-000000000001', 'Overhead Press', 'shoulders', '{"triceps", "core"}', 'barbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000002', 'Seated Dumbbell Shoulder Press', 'shoulders', '{"triceps"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000003', 'Dumbbell Lateral Raise', 'shoulders', '{}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000004', 'Cable Lateral Raise', 'shoulders', '{}', 'cable', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000005', 'Rear Delt Fly', 'shoulders', '{"back"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000006', 'Arnold Press', 'shoulders', '{"triceps"}', 'dumbbell', 'weight_reps', false, null),
('50000000-0000-0000-0000-000000000007', 'Upright Row', 'shoulders', '{"back"}', 'barbell', 'weight_reps', false, null),

-- Biceps
('60000000-0000-0000-0000-000000000001', 'Barbell Bicep Curl', 'biceps', '{}', 'barbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000002', 'Dumbbell Bicep Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000003', 'Hammer Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000004', 'Incline Dumbbell Curl', 'biceps', '{}', 'dumbbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000005', 'Preacher Curl', 'biceps', '{}', 'barbell', 'weight_reps', false, null),
('60000000-0000-0000-0000-000000000006', 'Cable Bicep Curl', 'biceps', '{}', 'cable', 'weight_reps', false, null),

-- Triceps
('70000000-0000-0000-0000-000000000001', 'Tricep Pushdown', 'triceps', '{}', 'cable', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000002', 'Skull Crusher', 'triceps', '{}', 'barbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000003', 'Overhead Tricep Extension', 'triceps', '{}', 'dumbbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000004', 'Close-Grip Bench Press', 'triceps', '{"chest"}', 'barbell', 'weight_reps', false, null),
('70000000-0000-0000-0000-000000000005', 'Tricep Dip', 'triceps', '{"chest"}', 'bodyweight', 'bodyweight_reps', false, null),

-- Core
('80000000-0000-0000-0000-000000000001', 'Plank', 'core', '{}', 'bodyweight', 'duration', false, null),
('80000000-0000-0000-0000-000000000002', 'Hanging Leg Raise', 'core', '{}', 'bodyweight', 'bodyweight_reps', false, null),
('80000000-0000-0000-0000-000000000003', 'Cable Crunch', 'core', '{}', 'cable', 'weight_reps', false, null),
('80000000-0000-0000-0000-000000000004', 'Ab Wheel Rollout', 'core', '{}', 'bodyweight', 'bodyweight_reps', false, null),

-- Calves
('90000000-0000-0000-0000-000000000001', 'Standing Calf Raise', 'calves', '{}', 'machine', 'weight_reps', false, null),
('90000000-0000-0000-0000-000000000002', 'Seated Calf Raise', 'calves', '{}', 'machine', 'weight_reps', false, null)
ON CONFLICT (id) DO NOTHING;
