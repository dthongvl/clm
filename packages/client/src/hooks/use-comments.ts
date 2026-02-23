import { useQuery } from '@tanstack/react-query';
import type { ReviewComment } from '@/types/review';
import { fetchPRComments } from '@/api/comments';
import { transformComments } from '@/lib/transforms';

interface UseCommentsReturn {
  comments: ReviewComment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useComments(): UseCommentsReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pr-comments'],
    queryFn: ({ signal }) => fetchPRComments(signal).then(transformComments),
  });

  return {
    comments: data ?? [],
    isLoading,
    error: error ?? null,
    refetch: async () => { await refetch() },
  };
}
