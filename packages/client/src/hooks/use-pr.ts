import { useCallback, useEffect, useState } from 'react';
import type { PRInfo } from '@/types/pr';
import { fetchPRInfo, fetchStatus } from '@/lib/api';
import { transformPRInfo } from '@/lib/transforms';

interface UsePROptions {
  prNumber?: number;
  repo?: string;
}

interface UsePRReturn {
  pr: PRInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePR({ prNumber, repo }: UsePROptions = {}): UsePRReturn {
  const [pr, setPR] = useState<PRInfo | null>(null);
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
      const serverPR = await fetchPRInfo(prNumber, repo);
      const clientPR = transformPRInfo(serverPR);
      setPR(clientPR);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch PR info'));
      setPR(null);
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
    pr,
    isLoading,
    error,
    refetch: fetchData,
  };
}

interface UseStatusReturn {
  ghAvailable: boolean;
  currentRepo: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useStatus(): UseStatusReturn {
  const [ghAvailable, setGhAvailable] = useState(false);
  const [currentRepo, setCurrentRepo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await fetchStatus();
        setGhAvailable(status.ghAvailable);
        setCurrentRepo(status.currentRepo);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch status'));
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
  }, []);

  return {
    ghAvailable,
    currentRepo,
    isLoading,
    error,
  };
}
