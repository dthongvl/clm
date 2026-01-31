import { useCallback, useEffect, useState } from 'react';
import type { ReviewComment } from '@/types/review';
import { fetchPRComments } from '@/lib/api';
import { transformComments } from '@/lib/transforms';

interface UseCommentsOptions {
  prNumber?: number;
  repo?: string;
}

interface UseCommentsReturn {
  comments: ReviewComment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useComments({ prNumber, repo }: UseCommentsOptions = {}): UseCommentsReturn {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!prNumber) {
      setError(new Error('PR number is required'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const serverComments = await fetchPRComments(prNumber, repo);
      const clientComments = transformComments(serverComments);
      setComments(clientComments);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch comments'));
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [prNumber, repo]);

  useEffect(() => {
    if (prNumber) {
      fetchData();
    }
  }, [prNumber, fetchData]);

  return {
    comments,
    isLoading,
    error,
    refetch: fetchData,
  };
}
