import { useQuery } from '@tanstack/react-query';
import type { DiffFileData } from '@/types/diff';
import { fetchPRDiff } from '@/api/diff';
import { transformFileDiffs } from '@/lib/transforms';

interface UseDiffOptions {
  includeContent?: boolean;
}

interface UseDiffReturn {
  files: DiffFileData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDiff({ includeContent = true }: UseDiffOptions = {}): UseDiffReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pr-diff', includeContent],
    queryFn: ({ signal }) => fetchPRDiff(includeContent, signal).then(transformFileDiffs),
  });

  return {
    files: data ?? [],
    isLoading,
    error: error ?? null,
    refetch: async () => { await refetch() },
  };
}
