import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findRelatedFiles } from '@/api/ai';

type RelatedFilesCache = Awaited<ReturnType<typeof findRelatedFiles>>;

export function useRelatedFiles() {
  const queryClient = useQueryClient();

  // useQuery subscribes to ['related-files'] cache
  const { data: files } = useQuery({
    queryKey: ['related-files' as const],
    queryFn: () => {
      const cached = queryClient.getQueryData<RelatedFilesCache>(['related-files']);
      return cached ?? [];
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (additionalContext?: string) => findRelatedFiles(additionalContext),
    mutationKey: ['related-files'],
    onSuccess: (data) => {
      queryClient.setQueryData(['related-files'], data);
    },
  });

  const findFiles = async (additionalContext?: string): Promise<boolean> => {
    try {
      await mutation.mutateAsync(additionalContext);
      return true;
    } catch {
      return false;
    }
  };

  return {
    files: files ?? [],
    findFiles,
    isLoading: mutation.isPending,
    error: mutation.error ?? null,
  };
}
