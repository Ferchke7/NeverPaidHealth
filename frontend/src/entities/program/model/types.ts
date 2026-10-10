export type SplitType = 'ppl' | 'upper_lower' | 'full_body' | 'bro_split' | 'custom';
export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ProgramDayExercise {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  target_sets: number;
  target_reps_min?: number;
  target_reps_max?: number;
}

export interface ProgramDay {
  day_number: number;
  name: string;
  notes?: string;
  exercises: ProgramDayExercise[];
}

export interface Program {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  split_type: SplitType;
  days_per_week: number;
  level: ProgramLevel;
  is_public: boolean;
  author_name?: string;
  likes_count: number;
  installs_count: number;
  days: ProgramDay[];
  created_at?: string;
  updated_at?: string;
}

export interface UserProgram {
  id: string;
  user_id: string;
  program_id: string;
  custom_name?: string;
  is_active: boolean;
  current_day_index: number;
  installed_at: string;
}

export interface ActiveProgramResponse {
  user_program?: UserProgram;
  program?: Program;
}

export interface InstalledProgramItem {
  user_program: UserProgram;
  program?: Program;
}
