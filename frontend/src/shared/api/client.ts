import { ENV } from '../config/env.ts';
import { useAuthStore } from '../../entities/user/model/authStore.ts';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(public problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  headers['Accept-Language'] = localStorage.getItem('np_app_lang') || 'ru';

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${ENV.API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null as T;
  }

  if (!response.ok) {
    let problem: ProblemDetails;
    try {
      problem = await response.json();
    } catch {
      problem = {
        type: 'about:blank',
        title: response.statusText,
        status: response.status,
        detail: `Request failed with status ${response.status}`,
      };
    }

    if (response.status === 401) {
      useAuthStore.getState().logout();
    }

    throw new ApiError(problem);
  }

  return (await response.json()) as T;
}

apiClient.get = <T>(endpoint: string, options?: RequestInit): Promise<T> =>
  apiClient<T>(endpoint, { method: 'GET', ...options });

apiClient.post = <T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> =>
  apiClient<T>(endpoint, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });

apiClient.put = <T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> =>
  apiClient<T>(endpoint, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });

apiClient.delete = <T>(endpoint: string, options?: RequestInit): Promise<T> =>
  apiClient<T>(endpoint, { method: 'DELETE', ...options });
