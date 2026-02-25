import { fetchApi } from './client';

export interface ServerPRComment {
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

export async function replyToComment(commentId: string, body: string): Promise<void> {
  await fetchApi(`/git/comments/${commentId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function editCommentById(commentId: string, body: string): Promise<void> {
  await fetchApi(`/git/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
}

export async function deleteCommentById(commentId: string): Promise<void> {
  await fetchApi(`/git/comments/${commentId}`, {
    method: 'DELETE',
  });
}
