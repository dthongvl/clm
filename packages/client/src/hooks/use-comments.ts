import { useCallback, useEffect, useState, useRef } from 'react';
import type { ReviewComment } from '@/types/review';
import { fetchPRComments } from '@/lib/api';
import { transformComments } from '@/lib/transforms';

interface UseCommentsReturn {
  comments: ReviewComment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useComments(): UseCommentsReturn {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const serverComments = await fetchPRComments(abortControllerRef.current.signal);
      const clientComments = transformComments(serverComments);
      setComments(clientComments);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error('Failed to fetch comments'));
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  return {
    comments,
    isLoading,
    error,
    refetch: fetchData,
  };
}
