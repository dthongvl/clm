import { useQuery } from '@tanstack/react-query';
import { fetchPRInfo } from '@/api/pr';
import { fetchStatus } from '@/api/status';
import { transformPRInfo } from '@/lib/transforms';

export function usePR() {
  return useQuery({
    queryKey: ['pr-info'],
    queryFn: ({ signal }) => fetchPRInfo(signal).then(transformPRInfo),
  });
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => fetchStatus(),
  });
}
