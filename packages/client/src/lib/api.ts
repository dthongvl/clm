// API client utilities for communicating with the server
import type { Settings, ModelOption } from '@/types/settings'

const API_BASE = '/api';

interface ApiError extends Error {
  status: number;
  details?: string;
}

interface FetchApiOptions extends RequestInit {
  signal?: AbortSignal;
}

async function fetchApi<T>(endpoint: string, options?: FetchApiOptions): Promise<T> {
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

export async function fetchPRInfo(prNumber: number, repo?: string, signal?: AbortSignal): Promise<ServerPRInfo> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  return fetchApi<ServerPRInfo>(`/pr-info?${params}`, { signal });
}

export async function fetchPRDiff(prNumber: number, repo?: string, includeContent = true, signal?: AbortSignal): Promise<ServerFileDiff[]> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  if (includeContent) params.set('includeContent', 'true');
  const response = await fetchApi<DiffResponse>(`/diff?${params}`, { signal });
  return response.files;
}

export async function fetchStatus(): Promise<StatusResponse> {
  return fetchApi<StatusResponse>('/pr-info/status');
}

// Refresh API - fetches branches and updates refs
interface RefreshResponse {
  success: boolean;
  prInfo: ServerPRInfo;
  refs: {
    baseRef: string;
    headRef: string;
  };
}

export async function refreshPR(prNumber: number, repo?: string, signal?: AbortSignal): Promise<RefreshResponse> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  return fetchApi<RefreshResponse>(`/refresh?${params}`, { method: 'POST', signal });
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

export async function fetchPRComments(prNumber: number, repo?: string, signal?: AbortSignal): Promise<ServerPRComment[]> {
  const params = new URLSearchParams({ pr: String(prNumber) });
  if (repo) params.set('repo', repo);
  const response = await fetchApi<CommentsResponse>(`/comments?${params}`, { signal });
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

// Grouping API
interface ServerChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: 'high' | 'medium' | 'low';
  riskReason?: string;
}

interface GroupingResponse {
  groups: ServerChangeGroup[];
}

export async function generateGrouping(prNumber: number, repo?: string): Promise<ServerChangeGroup[]> {
  const response = await fetchApi<GroupingResponse>('/grouping', {
    method: 'POST',
    body: JSON.stringify({ prNumber, repo }),
  });
  return response.groups;
}

// AI Review API
interface ServerAIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface AIReviewPRResponse {
  items: ServerAIReviewItem[];
  summary: string;
}

export async function generateAIReview(prNumber: number, repo?: string): Promise<AIReviewPRResponse> {
  const response = await fetchApi<AIReviewPRResponse>('/ai-review/pr', {
    method: 'POST',
    body: JSON.stringify({ prNumber, repo }),
  });
  return response;
}

// Related Files API
interface ServerRelatedFile {
  filePath: string;
  explanation: string;
}

interface RelatedFilesResponse {
  files: ServerRelatedFile[];
}

export async function findRelatedFiles(prNumber: number, repo?: string): Promise<ServerRelatedFile[]> {
  const response = await fetchApi<RelatedFilesResponse>('/related-files', {
    method: 'POST',
    body: JSON.stringify({ prNumber, repo }),
  });
  return response.files;
}

// Settings API
export async function fetchSettings(): Promise<Settings> {
  return fetchApi<Settings>('/settings');
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  return fetchApi<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Models API
interface ModelsResponse {
  models: ModelOption[];
}

export async function fetchModels(): Promise<ModelOption[]> {
  const response = await fetchApi<ModelsResponse>('/models');
  return response.models;
}

export type { ServerPRInfo, ServerFileDiff, StatusResponse, ServerPRComment, ServerDraftComment, ServerChangeGroup, ServerAIReviewItem, AIReviewPRResponse, ServerRelatedFile, RefreshResponse };
