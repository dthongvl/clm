import { fetchApi } from './client';
import type { Settings, ModelOption } from '@/types/settings';

export async function fetchSettings(): Promise<Settings> {
  return fetchApi<Settings>('/settings');
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  return fetchApi<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

interface ModelsResponse {
  models: ModelOption[];
}

export async function fetchModels(): Promise<ModelOption[]> {
  const response = await fetchApi<ModelsResponse>('/models');
  return response.models;
}
