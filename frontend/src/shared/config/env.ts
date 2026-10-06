export const ENV = {
  API_BASE_URL: ((import.meta as any).env?.VITE_API_BASE_URL as string) || '/api/v1',
  GOOGLE_CLIENT_ID: ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) || '',
  APP_ENV: ((import.meta as any).env?.VITE_APP_ENV as string) || 'development',
};

