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

export async function fetchPRInfo(signal?: AbortSignal): Promise<ServerPRInfo> {
  return fetchApi<ServerPRInfo>('/git/pr-info', { signal });
}

export async function fetchPRDiff(includeContent = true, signal?: AbortSignal): Promise<ServerFileDiff[]> {
  const params = new URLSearchParams();
  if (includeContent) params.set('includeContent', 'true');
  const query = params.toString();
  const response = await fetchApi<DiffResponse>(`/git/diff${query ? `?${query}` : ''}`, { signal });
  return response.files;
}

export async function fetchStatus(): Promise<StatusResponse> {
  return fetchApi<StatusResponse>('/git/pr-info/status');
}

// Refresh API - fetches branches and updates refs
interface RefreshResponse {
  prInfo: ServerPRInfo;
  refs: {
    baseRef: string;
    headRef: string;
  };
}

export async function refreshPR(signal?: AbortSignal): Promise<RefreshResponse> {
  return fetchApi<RefreshResponse>('/git/refresh', {
    method: 'POST',
    signal,
  });
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

export async function fetchPRComments(signal?: AbortSignal): Promise<ServerPRComment[]> {
  const response = await fetchApi<CommentsResponse>('/git/comments', { signal });
  return response.comments;
}

// Draft Review API (GitHub-backed)
interface ServerDraftReview {
  id: string;
  state: 'PENDING';
}

interface ServerDraftReviewComment {
  id: string;
  reviewId: string;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  authorName: string;
  authorAvatarUrl: string;
  createdAt: string;
}

interface DraftReviewResponse {
  review: ServerDraftReview | null;
  comments: ServerDraftReviewComment[];
}

interface CreateDraftReviewCommentResponse {
  comment: ServerDraftReviewComment;
}

interface UpdateDraftReviewCommentResponse {
  comment: ServerDraftReviewComment;
}

interface SubmitDraftReviewResponse {
  submitted: boolean;
}

export async function fetchDraftReview(): Promise<DraftReviewResponse> {
  return fetchApi<DraftReviewResponse>('/reviews/draft');
}

export async function createDraftReviewComment(
  filePath: string,
  lineNumber: number,
  side: 'additions' | 'deletions',
  content: string,
): Promise<ServerDraftReviewComment> {
  const response = await fetchApi<CreateDraftReviewCommentResponse>('/reviews/draft/comments', {
    method: 'POST',
    body: JSON.stringify({ filePath, lineNumber, side, content }),
  });
  return response.comment;
}

export async function updateDraftReviewComment(
  commentId: string,
  content: string,
): Promise<ServerDraftReviewComment> {
  const response = await fetchApi<UpdateDraftReviewCommentResponse>(`/reviews/draft/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  return response.comment;
}

export async function deleteDraftReviewComment(commentId: string): Promise<void> {
  await fetchApi(`/reviews/draft/comments/${commentId}`, {
    method: 'DELETE',
  });
}

export async function submitDraftReview(
  event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE',
  body?: string,
): Promise<SubmitDraftReviewResponse> {
  return fetchApi<SubmitDraftReviewResponse>('/reviews/draft/submit', {
    method: 'POST',
    body: JSON.stringify({ event, body }),
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

function buildAIActionBody(additionalContext?: string) {
  return additionalContext ? { additionalContext } : {};
}

export async function generateGrouping(additionalContext?: string): Promise<ServerChangeGroup[]> {
  const response = await fetchApi<GroupingResponse>('/ai/grouping', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
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

export async function generateAIReview(additionalContext?: string): Promise<AIReviewPRResponse> {
  const response = await fetchApi<AIReviewPRResponse>('/ai/review/pr', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
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

export async function findRelatedFiles(additionalContext?: string): Promise<ServerRelatedFile[]> {
  const response = await fetchApi<RelatedFilesResponse>('/ai/related-files', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
  });
  return response.files;
}

// Pattern Verification API
import type { PatternVerificationResult } from '@/types/verification'

export async function verifyPatterns(additionalContext?: string): Promise<PatternVerificationResult> {
  return fetchApi<PatternVerificationResult>('/ai/pattern-verification', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
  });
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

// Viewed Files API (GitHub-backed)
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

export type { ServerPRInfo, ServerFileDiff, StatusResponse, ServerPRComment, ServerChangeGroup, ServerAIReviewItem, AIReviewPRResponse, ServerRelatedFile, RefreshResponse, ServerDraftReview, ServerDraftReviewComment, DraftReviewResponse };
