const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

export function getApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  return typeof raw === 'string' && raw.length > 0 ? raw.replace(/\/$/, '') : DEFAULT_API_URL;
}
