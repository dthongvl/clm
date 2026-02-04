import { useState, useCallback, useEffect } from 'react';
import {
  fetchDraftComments,
  createDraftComment,
  deleteDraftComment,
  clearDraftComments,
  type ServerDraftComment,
} from '@/lib/api';
import type { ReviewComment } from '@/types/review';

interface UseDraftCommentsOptions {
  prNumber?: number;
}

interface UseDraftCommentsReturn {
  /** Draft comments stored on the server */
  draftComments: ReviewComment[];
  /** Whether the initial fetch is loading */
  isLoading: boolean;
  /** Error from fetching or submitting */
  error: Error | null;
  /** Add a new draft comment */
  addDraftComment: (
    filePath: string,
    lineNumber: number,
    side: 'additions' | 'deletions',
    content: string
  ) => Promise<void>;
  /** Remove a draft comment */
  removeDraftComment: (commentId: string) => Promise<void>;
  /** Clear all draft comments */
  clearAllDraftComments: () => Promise<void>;
  /** Refetch draft comments from server */
  refetch: () => Promise<void>;
}

/** Transform server draft comment to ReviewComment format */
function transformDraftComment(draft: ServerDraftComment): ReviewComment {
  return {
    id: draft.id,
    filePath: draft.filePath,
    lineNumber: draft.lineNumber,
    side: draft.side,
    content: draft.content,
    author: { type: 'human', name: draft.authorName },
    createdAt: new Date(draft.createdAt),
    replies: [],
    // Draft comments are not yet submitted, so no severity
  };
}

export function useDraftComments({ prNumber }: UseDraftCommentsOptions): UseDraftCommentsReturn {
  const [draftComments, setDraftComments] = useState<ReviewComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchComments = useCallback(async () => {
    if (!prNumber) {
      setDraftComments([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const comments = await fetchDraftComments(prNumber);
      setDraftComments(comments.map(transformDraftComment));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch draft comments'));
    } finally {
      setIsLoading(false);
    }
  }, [prNumber]);

  // Fetch on mount and when prNumber changes
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
      if (!prNumber) {
        throw new Error('PR number is required');
      }

      const newComment = await createDraftComment(
        prNumber,
        filePath,
        lineNumber,
        side,
        content
      );

      setDraftComments((prev) => [...prev, transformDraftComment(newComment)]);
    },
    [prNumber]
  );

  const removeDraftComment = useCallback(
    async (commentId: string) => {
      if (!prNumber) {
        throw new Error('PR number is required');
      }

      await deleteDraftComment(prNumber, commentId);
      setDraftComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [prNumber]
  );

  const clearAllDraftComments = useCallback(async () => {
    if (!prNumber) {
      throw new Error('PR number is required');
    }

    await clearDraftComments(prNumber);
    setDraftComments([]);
  }, [prNumber]);

  return {
    draftComments,
    isLoading,
    error,
    addDraftComment,
    removeDraftComment,
    clearAllDraftComments,
    refetch: fetchComments,
  };
}
