import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPRViewedFiles, updatePRFileViewedState } from '@/api/viewed-files';
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
  const queryClient = useQueryClient()
  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());

  const { data: viewedFiles = new Set<string>(), isLoading, error, refetch } = useQuery({
    queryKey: ['pr-viewed-files'],
    queryFn: async ({ signal }) => {
      const states = await fetchPRViewedFiles(signal);
      const viewed = new Set<string>();
      for (const file of states) {
        if (file.state === 'VIEWED') {
          viewed.add(file.path);
        }
      }
      return viewed;
    },
  });

  const setViewed = useCallback(async (filePath: string, viewed: boolean) => {
    // Ignore if already syncing this file
    if (syncingFiles.has(filePath)) {
      return;
    }

    // Capture previous state for rollback
    const previousViewedFiles = queryClient.getQueryData<Set<string>>(['pr-viewed-files']);

    // Optimistic update
    queryClient.setQueryData<Set<string>>(['pr-viewed-files'], (prev) => {
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
    } catch {
      // Rollback on failure
      if (previousViewedFiles) {
        queryClient.setQueryData(['pr-viewed-files'], previousViewedFiles);
      }
      toast.error(`Failed to mark file as ${viewed ? 'viewed' : 'unviewed'}`);
    } finally {
      setSyncingFiles((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    }
  }, [queryClient, syncingFiles]);

  return {
    viewedFiles,
    syncingFiles,
    error: error ?? null,
    isLoading,
    setViewed,
    refetch: async () => { await refetch() },
  };
}
