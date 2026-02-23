import { fetchApi } from './client';

export type ViewedState = 'VIEWED' | 'UNVIEWED' | 'DISMISSED';

export interface ViewedFileState {
  path: string;
  state: ViewedState;
}

interface ViewedFilesResponse {
  states: ViewedFileState[];
}

export async function fetchPRViewedFiles(signal?: AbortSignal): Promise<ViewedFileState[]> {
  const response = await fetchApi<ViewedFilesResponse>('/git/viewed-files', { signal });
  return response.states;
}

export async function updatePRFileViewedState(
  filePath: string,
  viewed: boolean,
): Promise<ViewedFileState> {
  return fetchApi<ViewedFileState>('/git/viewed-files', {
    method: 'POST',
    body: JSON.stringify({ filePath, viewed }),
  });
}
