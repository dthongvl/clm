import { useQuery } from '@tanstack/react-query';
import type { PRInfo } from '@/types/pr';
import { fetchPRInfo } from '@/api/pr';
import { fetchStatus } from '@/api/status';
import { transformPRInfo } from '@/lib/transforms';

interface UsePRReturn {
  pr: PRInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePR(): UsePRReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pr-info'],
    queryFn: ({ signal }) => fetchPRInfo(signal).then(transformPRInfo),
  });

  return {
    pr: data ?? null,
    isLoading,
    error: error ?? null,
    refetch: async () => { await refetch() },
  };
}

interface UseStatusReturn {
  ghAvailable: boolean;
  currentRepo: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useStatus(): UseStatusReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['status'],
    queryFn: () => fetchStatus(),
  });

  return {
    ghAvailable: data?.ghAvailable ?? false,
    currentRepo: data?.currentRepo ?? null,
    isLoading,
    error: error ?? null,
  };
}
