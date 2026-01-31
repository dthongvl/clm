import { useCallback, useEffect, useState } from 'react';
import type { DiffFileData } from '@/components/diff-panel';
import { fetchPRDiff } from '@/lib/api';
import { transformFileDiffs } from '@/lib/transforms';

interface UseDiffOptions {
  prNumber?: number;
  repo?: string;
  includeContent?: boolean;
}

interface UseDiffReturn {
  files: DiffFileData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDiff({ prNumber, repo, includeContent = true }: UseDiffOptions = {}): UseDiffReturn {
  const [files, setFiles] = useState<DiffFileData[]>([]);
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
      const serverFiles = await fetchPRDiff(prNumber, repo, includeContent);
      const clientFiles = transformFileDiffs(serverFiles);
      setFiles(clientFiles);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch diff'));
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [prNumber, repo, includeContent]);

  useEffect(() => {
    if (prNumber) {
      fetchData();
    }
  }, [prNumber, fetchData]);

  return {
    files,
    isLoading,
    error,
    refetch: fetchData,
  };
}
