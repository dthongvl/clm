import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { verifyPatterns } from '@/api/ai';
import type { PatternVerificationResult } from '@/types/verification';

export function usePatternVerification() {
  const queryClient = useQueryClient();

  // useQuery subscribes to ['pattern-verification'] cache
  const { data: result } = useQuery({
    queryKey: ['pattern-verification' as const],
    queryFn: () => {
      const cached = queryClient.getQueryData<PatternVerificationResult>(['pattern-verification']);
      return cached ?? null;
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (additionalContext?: string) => verifyPatterns(additionalContext),
    mutationKey: ['pattern-verification'],
    onSuccess: (data) => {
      queryClient.setQueryData(['pattern-verification'], data);
    },
  });

  const verify = async (additionalContext?: string): Promise<boolean> => {
    try {
      await mutation.mutateAsync(additionalContext);
      return true;
    } catch {
      return false;
    }
  };

  return {
    result: result ?? null,
    isLoading: mutation.isPending,
    error: mutation.error ?? null,
    verify,
  };
}
