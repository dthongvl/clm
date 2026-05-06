import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateGrouping, generateAIReview } from '@/api/ai';
import { transformAIReviewItems, transformChangeGroups } from '@/lib/transforms';
import type { AIReviewItem } from '@/types/review';
import type { ChangeGroup } from '@/types/grouping';
import type { AIReviewOptions } from '@/components/side-panel/action-trigger-with-context';

interface ReviewCache {
  items: AIReviewItem[];
  summary: string;
}

const EMPTY_REVIEW: ReviewCache = { items: [], summary: '' };

export function useAIReview() {
  const queryClient = useQueryClient();

  // useQuery subscribes to ['ai-review'] cache — re-renders when mutations write
  const { data: reviewData } = useQuery({
    queryKey: ['ai-review' as const],
    queryFn: () => {
      const cached = queryClient.getQueryData<ReviewCache>(['ai-review']);
      return cached ?? EMPTY_REVIEW;
    },
    staleTime: Infinity,
  });

  // useQuery subscribes to ['ai-grouping'] cache
  const { data: groups } = useQuery({
    queryKey: ['ai-grouping' as const],
    queryFn: () => {
      const cached = queryClient.getQueryData<ChangeGroup[]>(['ai-grouping']);
      return cached ?? [];
    },
    staleTime: Infinity,
  });

  const reviewMutation = useMutation({
    mutationFn: (params: { additionalContext?: string; options?: AIReviewOptions }) =>
      generateAIReview({
        additionalContext: params.additionalContext,
        reviewCategories: params.options?.reviewCategories,
        runMode: params.options?.runMode,
      }),
    mutationKey: ['ai-review'],
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-review'], {
        items: transformAIReviewItems(data.items),
        summary: data.summary,
      });
    },
  });

  const groupingMutation = useMutation({
    mutationFn: (additionalContext?: string) => generateGrouping(additionalContext),
    mutationKey: ['ai-grouping'],
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-grouping'], transformChangeGroups(data));
    },
  });

  const triggerReview = async (additionalContext?: string, options?: AIReviewOptions): Promise<boolean> => {
    try {
      await reviewMutation.mutateAsync({ additionalContext, options });
      return true;
    } catch {
      return false;
    }
  };

  const generateGroups = async (additionalContext?: string): Promise<boolean> => {
    try {
      await groupingMutation.mutateAsync(additionalContext);
      return true;
    } catch {
      return false;
    }
  };

  return {
    items: reviewData?.items ?? [],
    summary: reviewData?.summary ?? '',
    groups: groups ?? [],
    triggerReview,
    generateGroups,
    isLoading: reviewMutation.isPending,
    isGeneratingGroups: groupingMutation.isPending,
    error: reviewMutation.error ?? groupingMutation.error ?? null,
  };
}
