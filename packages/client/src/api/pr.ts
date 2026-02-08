import { fetchApi } from './client';

export interface ServerPRInfo {
  number: number;
  title: string;
  author: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  repo: string;
}

export interface RefreshResponse {
  prInfo: ServerPRInfo;
  refs: {
    baseRef: string;
    headRef: string;
  };
}

export async function fetchPRInfo(signal?: AbortSignal): Promise<ServerPRInfo> {
  return fetchApi<ServerPRInfo>('/git/pr-info', { signal });
}

export async function refreshPR(signal?: AbortSignal): Promise<RefreshResponse> {
  return fetchApi<RefreshResponse>('/git/refresh', {
    method: 'POST',
    signal,
  });
}
