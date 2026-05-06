import { useQuery } from '@tanstack/react-query';
import { fetchPRDiff } from '@/api/diff';
import { transformFileDiffs } from '@/lib/transforms';

export function useDiff({ includeContent = true }: { includeContent?: boolean } = {}) {
  return useQuery({
    queryKey: ['pr-diff', includeContent],
    queryFn: ({ signal }) => fetchPRDiff(includeContent, signal).then(transformFileDiffs),
  });
}
