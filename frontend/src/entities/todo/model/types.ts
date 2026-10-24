export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'archived';
export type TodoCategory = 'work' | 'workout' | 'study' | 'health' | 'meeting' | 'personal';
export type TodoEventType = 'task' | 'meeting' | 'routine' | 'habit';

export interface DayProgressItem {
  todo_id: string;
  day: string; // "YYYY-MM-DD"
  status: TodoStatus;
  completed_at?: string;
  spent_minutes: number;
}

export interface TodoItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: TodoCategory;
  priority: TodoPriority;
  event_type: TodoEventType;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;   // "YYYY-MM-DD"
  start_time?: string; // "09:00"
  end_time?: string;   // "10:30"
  target_duration_minutes: number;
  total_spent_minutes: number; // For the requested date
  lifetime_spent_minutes?: number; // Across all days
  status: TodoStatus; // For the requested date
  completed_at?: string;
  meeting_url?: string;
  external_calendar_id?: string;
  has_conflict?: boolean;
  conflicting_with?: string;
  is_multi_day?: boolean;
  total_days?: number;
  completed_days?: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogItem {
  id: string;
  user_id: string;
  todo_id?: string;
  task_title: string;
  category: TodoCategory;
  log_date?: string; // "YYYY-MM-DD"
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  session_type: 'pomodoro' | 'stopwatch' | 'timer' | 'manual' | 'task_completed' | string;
  notes?: string;
  created_at: string;
}

export interface DailyScheduleResponse {
  date: string;
  total_tasks: number;
  completed_tasks: number;
  total_planned_minutes: number;
  total_spent_minutes: number;
  todos: TodoItem[];
  recent_logs?: ActivityLogItem[];
  day_progress?: DayProgressItem[];
}

export interface CategoryStatsItem {
  category: TodoCategory;
  total_minutes: number;
  tasks_count: number;
}

export interface ProductivityStatsResponse {
  period_days: number;
  total_focus_minutes: number;
  total_tasks_done: number;
  category_breakdown: CategoryStatsItem[];
}
