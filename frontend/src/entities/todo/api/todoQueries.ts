import { QueryClient } from '@tanstack/react-query';

export const todoQueryKeys = {
  all: ['todos'] as const,
  daily: (date?: string) => ['todos-daily', date || 'today'] as const,
  month: (monthKey?: string) => ['todos-month', monthKey || 'current'] as const,
  logs: (date?: string) => ['activity-logs', date || 'all'] as const,
  monthLogs: (monthKey?: string) => ['activity-logs-month', monthKey || 'current'] as const,
  stats: (days?: number) => ['todo-stats', days || 7] as const,
};

export function invalidateTodoQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['todos-daily'] });
  void qc.invalidateQueries({ queryKey: ['todos-month'] });
  void qc.invalidateQueries({ queryKey: ['activity-logs'] });
  void qc.invalidateQueries({ queryKey: ['activity-logs-month'] });
  void qc.invalidateQueries({ queryKey: ['todo-stats'] });
}
