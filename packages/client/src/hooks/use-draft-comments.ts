import { useState, useCallback, useEffect } from 'react';
import {
  fetchDraftReview,
  createDraftReviewComment,
  updateDraftReviewComment,
  deleteDraftReviewComment,
  submitDraftReview as submitDraftReviewApi,
  type ServerDraftReviewComment,
} from '@/lib/api';
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
    author: { type: 'human', name: draft.authorName },
    createdAt: new Date(draft.createdAt),
    replies: [],
    isDraft: true,
    editable: true,
    reviewId: draft.reviewId,
  };
}

export function useDraftComments(): UseDraftCommentsReturn {
  const [draftComments, setDraftComments] = useState<ReviewComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchDraftReview();
      setDraftComments(response.comments.map(transformDraftReviewComment));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch draft comments'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addDraftComment = useCallback(
    async (
      filePath: string,
      lineNumber: number,
      side: 'additions' | 'deletions',
      content: string
    ) => {
      const newComment = await createDraftReviewComment(
        filePath,
        lineNumber,
        side,
        content
      );

      setDraftComments((prev) => [...prev, transformDraftReviewComment(newComment)]);
    },
    []
  );

  const updateDraftComment = useCallback(
    async (commentId: string, content: string) => {
      const updated = await updateDraftReviewComment(commentId, content);
      setDraftComments((prev) =>
        prev.map((c) => (c.id === commentId ? transformDraftReviewComment(updated) : c))
      );
    },
    []
  );

  const removeDraftComment = useCallback(
    async (commentId: string) => {
      await deleteDraftReviewComment(commentId);
      setDraftComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    []
  );

  const submitReview = useCallback(
    async (event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE', body?: string) => {
      await submitDraftReviewApi(event, body);
      setDraftComments([]);
    },
    []
  );

  return {
    draftComments,
    isLoading,
    error,
    addDraftComment,
    updateDraftComment,
    removeDraftComment,
    submitDraftReview: submitReview,
    draftCount: draftComments.length,
    refetch: fetchComments,
  };
}
