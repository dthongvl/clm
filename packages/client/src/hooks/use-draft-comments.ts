import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDraftReview,
  createDraftReviewComment,
  updateDraftReviewComment,
  deleteDraftReviewComment,
  submitDraftReview as submitDraftReviewApi,
  type ServerDraftReviewComment,
} from '@/api/draft-reviews';
import type { ReviewComment } from '@/types/review';

interface UseDraftCommentsReturn {
  draftComments: ReviewComment[];
  isLoading: boolean;
  error: Error | null;
  addDraftComment: (
    filePath: string,
    lineNumber: number,
    side: 'additions' | 'deletions',
    content: string
  ) => Promise<void>;
  updateDraftComment: (commentId: string, content: string) => Promise<void>;
  removeDraftComment: (commentId: string) => Promise<void>;
  submitDraftReview: (
    event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE',
    body?: string
  ) => Promise<void>;
  draftCount: number;
  refetch: () => Promise<void>;
}

function transformDraftReviewComment(draft: ServerDraftReviewComment): ReviewComment {
  return {
    id: draft.id,
    filePath: draft.filePath,
    lineNumber: draft.lineNumber,
    side: draft.side,
    content: draft.content,
    author: { type: 'human', name: draft.authorName, avatarUrl: draft.authorAvatarUrl },
    createdAt: new Date(draft.createdAt),
    replies: [],
    isDraft: true,
    editable: true,
    reviewId: draft.reviewId,
  };
}

export function useDraftComments(): UseDraftCommentsReturn {
  const queryClient = useQueryClient();

  const { data: draftComments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['draft-comments'],
    queryFn: async () => {
      const response = await fetchDraftReview();
      return response.comments.map(transformDraftReviewComment);
    },
  });

  const addDraftComment = useCallback(
    async (
      filePath: string,
      lineNumber: number,
      side: 'additions' | 'deletions',
      content: string
    ) => {
      const newComment = await createDraftReviewComment(filePath, lineNumber, side, content);
      queryClient.setQueryData<ReviewComment[]>(['draft-comments'], (prev) => [
        ...(prev ?? []),
        transformDraftReviewComment(newComment),
      ]);
    },
    [queryClient]
  );

  const updateDraftComment = useCallback(
    async (commentId: string, content: string) => {
      const updated = await updateDraftReviewComment(commentId, content);
      queryClient.setQueryData<ReviewComment[]>(['draft-comments'], (prev) =>
        (prev ?? []).map((c) => (c.id === commentId ? transformDraftReviewComment(updated) : c))
      );
    },
    [queryClient]
  );

  const removeDraftComment = useCallback(
    async (commentId: string) => {
      await deleteDraftReviewComment(commentId);
      queryClient.setQueryData<ReviewComment[]>(['draft-comments'], (prev) =>
        (prev ?? []).filter((c) => c.id !== commentId)
      );
    },
    [queryClient]
  );

  const submitReview = useCallback(
    async (event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE', body?: string) => {
      await submitDraftReviewApi(event, body);
      queryClient.setQueryData(['draft-comments'], []);
    },
    [queryClient]
  );

  return {
    draftComments,
    isLoading,
    error: error ?? null,
    addDraftComment,
    updateDraftComment,
    removeDraftComment,
    submitDraftReview: submitReview,
    draftCount: draftComments.length,
    refetch: async () => { await refetch() },
  };
}
