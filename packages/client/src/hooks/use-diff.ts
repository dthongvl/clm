import { useCallback, useEffect, useState, useRef } from 'react';
import type { DiffFileData } from '@/components/diff-panel';
import { fetchPRDiff } from '@/lib/api';
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
  const [files, setFiles] = useState<DiffFileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const serverFiles = await fetchPRDiff(includeContent, abortControllerRef.current.signal);
      const clientFiles = transformFileDiffs(serverFiles);
      setFiles(clientFiles);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error('Failed to fetch diff'));
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [includeContent]);

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  return {
    files,
    isLoading,
    error,
    refetch: fetchData,
  };
}
