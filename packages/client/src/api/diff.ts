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

interface FileContentResponse {
  filename: string;
  base: { ref: string; content: string | null };
  head: { ref: string; content: string | null };
}

export async function fetchFileContent(filename: string, signal?: AbortSignal): Promise<FileContentResponse> {
  const params = new URLSearchParams({ filename });
  return fetchApi<FileContentResponse>(`/git/diff/file?${params.toString()}`, { signal });
}
