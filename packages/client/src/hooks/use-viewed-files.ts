import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchPRViewedFiles, updatePRFileViewedState } from '@/lib/api';
import { toast } from 'sonner';

interface UseViewedFilesReturn {
  /** Set of file paths that are marked as viewed */
  viewedFiles: Set<string>;
  /** Set of file paths currently syncing with server */
  syncingFiles: Set<string>;
  /** Error from last operation */
  error: Error | null;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Toggle viewed state for a file with optimistic update */
  setViewed: (filePath: string, viewed: boolean) => Promise<void>;
  /** Refetch viewed state from server */
  refetch: () => Promise<void>;
}

/**
 * Hook to manage viewed file state synced with GitHub.
 *
 * Behavior:
 * - Initial load: files with VIEWED state are checked
 * - DISMISSED state is treated as not viewed (unchecked)
 * - Optimistic updates with rollback on failure
 * - Prevents duplicate toggles while syncing
 */
export function useViewedFiles(): UseViewedFilesReturn {
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchViewedState = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const states = await fetchPRViewedFiles(abortControllerRef.current.signal);

      // Map to Set: only VIEWED state counts as viewed
      // DISMISSED is treated as not viewed per GitHub's behavior
      const viewed = new Set<string>();
      for (const file of states) {
        if (file.state === 'VIEWED') {
          viewed.add(file.path);
        }
      }
      setViewedFiles(viewed);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const error = err instanceof Error ? err : new Error('Failed to fetch viewed files');
      setError(error);
      // Don't show toast on initial load failure - it's not critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViewedState();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchViewedState]);

  const setViewed = useCallback(async (filePath: string, viewed: boolean) => {
    // Ignore if already syncing this file
    if (syncingFiles.has(filePath)) {
      return;
    }

    // Optimistic update
    const previousViewedFiles = new Set(viewedFiles);
    setViewedFiles((prev) => {
      const next = new Set(prev);
      if (viewed) {
        next.add(filePath);
      } else {
        next.delete(filePath);
      }
      return next;
    });

    // Track syncing state
    setSyncingFiles((prev) => {
      const next = new Set(prev);
      next.add(filePath);
      return next;
    });

    try {
      await updatePRFileViewedState(filePath, viewed);
      setError(null);
    } catch (err) {
      // Rollback on failure
      setViewedFiles(previousViewedFiles);

      const error = err instanceof Error ? err : new Error('Failed to update viewed state');
      setError(error);
      toast.error(`Failed to mark file as ${viewed ? 'viewed' : 'unviewed'}`);
    } finally {
      setSyncingFiles((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    }
  }, [viewedFiles, syncingFiles]);

  return {
    viewedFiles,
    syncingFiles,
    error,
    isLoading,
    setViewed,
    refetch: fetchViewedState,
  };
}
