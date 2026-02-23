import { fetchApi } from './client';

export interface StatusResponse {
  ghAvailable: boolean;
  currentRepo: string | null;
}

export async function fetchStatus(): Promise<StatusResponse> {
  return fetchApi<StatusResponse>('/git/pr-info/status');
}
