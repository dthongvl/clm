// API client utilities for communicating with the server

const API_BASE = '/api';

interface ApiError extends Error {
  status: number;
  details?: string;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
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

// Server response types
interface ServerPRInfo {
  number: number;
  title: string;
  author: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  repo: string;
}

interface ServerFileDiff {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  baseContent?: string;
  headContent?: string;
}

interface DiffResponse {
  files: ServerFileDiff[];
}

interface StatusResponse {
  ghAvailable: boolean;
  currentRepo: string | null;
}

// API functions

export async function fetchPRInfo(prNumber: number, repo?: string): Promise<ServerPRInfo> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  return fetchApi<ServerPRInfo>(`/pr-info?${params}`);
}

export async function fetchPRDiff(prNumber: number, repo?: string, includeContent = true): Promise<ServerFileDiff[]> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  if (includeContent) params.set('includeContent', 'true');
  const response = await fetchApi<DiffResponse>(`/diff?${params}`);
  return response.files;
}

export async function fetchStatus(): Promise<StatusResponse> {
  return fetchApi<StatusResponse>('/pr-info/status');
}

export type { ServerPRInfo, ServerFileDiff, StatusResponse };
