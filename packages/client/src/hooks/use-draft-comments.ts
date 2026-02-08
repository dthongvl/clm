import { useState, useCallback, useEffect } from 'react';
import {
  fetchDraftComments,
  createDraftComment,
  deleteDraftComment,
  clearDraftComments,
  type ServerDraftComment,
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
  removeDraftComment: (commentId: string) => Promise<void>;
  clearAllDraftComments: () => Promise<void>;
  refetch: () => Promise<void>;
}

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
      const comments = await fetchDraftComments();
      setDraftComments(comments.map(transformDraftComment));
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
      const newComment = await createDraftComment(
        filePath,
        lineNumber,
        side,
        content
      );

      setDraftComments((prev) => [...prev, transformDraftComment(newComment)]);
    },
    []
  );

  const removeDraftComment = useCallback(
    async (commentId: string) => {
      await deleteDraftComment(commentId);
      setDraftComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    []
  );

  const clearAllDraftComments = useCallback(async () => {
    await clearDraftComments();
    setDraftComments([]);
  }, []);

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
