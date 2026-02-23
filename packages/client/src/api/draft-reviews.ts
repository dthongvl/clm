import { fetchApi } from './client';

export interface ServerDraftReview {
  id: string;
  state: 'PENDING';
}

export interface ServerDraftReviewComment {
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

export interface DraftReviewResponse {
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
