export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'shoulders'
  | 'arms'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'abductors'
  | 'adductors'
  | 'neck'
  | 'core'
  | 'full_body'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'smith_machine'
  | 'bands'
  | 'band'
  | 'ez_bar'
  | 'exercise_ball'
  | 'medicine_ball'
  | 'foam_roller'
  | 'other';

export type MeasurementType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'duration'
  | 'distance_duration';

export interface Exercise {
  id: string;
  name: string;
  primary_muscle_group: MuscleGroup | string;
  primary_muscle?: MuscleGroup | string;
  secondary_muscle_groups?: string[];
  equipment: Equipment | string;
  measurement_type: MeasurementType | string;
  instructions?: string | string[];
  is_custom: boolean;
  created_by_user_id?: string;
  source_id?: string;
  category?: string;
  level?: string;
}
