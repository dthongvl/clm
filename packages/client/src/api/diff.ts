import { fetchApi } from './client';

export interface ServerFileDiff {
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

export async function fetchPRDiff(includeContent = true, signal?: AbortSignal): Promise<ServerFileDiff[]> {
  const params = new URLSearchParams();
  if (includeContent) params.set('includeContent', 'true');
  const query = params.toString();
  const response = await fetchApi<DiffResponse>(`/git/diff${query ? `?${query}` : ''}`, { signal });
  return response.files;
}
