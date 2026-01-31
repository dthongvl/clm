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

// Server response type for PR comments
interface ServerPRComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  path?: string;
  line?: number;
  original_line?: number;
  side?: 'LEFT' | 'RIGHT';
  in_reply_to_id?: number;
  diff_hunk?: string;
}

interface CommentsResponse {
  comments: ServerPRComment[];
}

export async function fetchPRComments(prNumber: number, repo?: string): Promise<ServerPRComment[]> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  const response = await fetchApi<CommentsResponse>(`/comments?${params}`);
  return response.comments;
}

// Draft comments API
interface ServerDraftComment {
  id: string;
  prNumber: number;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  authorName: string;
  createdAt: string;
}

interface DraftCommentsResponse {
  comments: ServerDraftComment[];
}

interface CreateDraftCommentResponse {
  success: boolean;
  comment: ServerDraftComment;
}

export async function fetchDraftComments(prNumber: number): Promise<ServerDraftComment[]> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  const response = await fetchApi<DraftCommentsResponse>(`/draft-comments?${params}`);
  return response.comments;
}

export async function createDraftComment(
  prNumber: number,
  filePath: string,
  lineNumber: number,
  side: 'additions' | 'deletions',
  content: string,
  authorName = 'You'
): Promise<ServerDraftComment> {
  const response = await fetchApi<CreateDraftCommentResponse>('/draft-comments', {
    method: 'POST',
    body: JSON.stringify({ prNumber, filePath, lineNumber, side, content, authorName }),
  });
  return response.comment;
}

export async function deleteDraftComment(prNumber: number, commentId: string): Promise<void> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  await fetchApi<{ success: boolean }>(`/draft-comments/${commentId}?${params}`, {
    method: 'DELETE',
  });
}

export async function clearDraftComments(prNumber: number): Promise<void> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  await fetchApi<{ success: boolean }>(`/draft-comments?${params}`, {
    method: 'DELETE',
  });
}

export type { ServerPRInfo, ServerFileDiff, StatusResponse, ServerPRComment, ServerDraftComment };
