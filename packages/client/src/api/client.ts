export const API_BASE = '/api';

export interface ApiError extends Error {
  status: number;
  details?: string;
}

export interface FetchApiOptions extends RequestInit {
  signal?: AbortSignal;
}

export async function fetchApi<T>(endpoint: string, options?: FetchApiOptions): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    signal: options?.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || 'API request failed') as ApiError;
    error.status = response.status;
    error.details = errorData.details;
    throw error;
  }

  return response.json();
}
