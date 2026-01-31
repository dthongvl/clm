import { useCallback, useState } from 'react';
import type { AIReviewItem, ChangeGroup } from '@/types';

interface UseAIReviewReturn {
  items: AIReviewItem[];
  groups: ChangeGroup[];
  triggerReview: () => Promise<void>;
  generateGroups: () => Promise<void>;
  isLoading: boolean;
  isGeneratingGroups: boolean;
}

const mockReviewItems: AIReviewItem[] = [
  {
    id: '1',
    filePath: 'src/components/Button.tsx',
    lineNumber: 15,
    severity: 'warning',
    message: 'Consider adding aria-label for accessibility',
    suggestion: 'aria-label="Submit form"',
  },
  {
    id: '2',
    filePath: 'src/utils/helpers.ts',
    lineNumber: 42,
    severity: 'critical',
    message: 'Potential null pointer exception',
    suggestion: 'Add null check before accessing property',
  },
  {
    id: '3',
    filePath: 'src/hooks/useData.ts',
    lineNumber: 8,
    severity: 'info',
    message: 'Consider memoizing this callback',
  },
];

const mockGroups: ChangeGroup[] = [
  {
    id: 'group-1',
    title: 'UI Components',
    summary: 'Updates to button and form components',
    files: ['src/components/Button.tsx', 'src/components/Form.tsx'],
    totalAdditions: 45,
    totalDeletions: 12,
  },
  {
    id: 'group-2',
    title: 'Utility Functions',
    summary: 'Refactored helper utilities',
    files: ['src/utils/helpers.ts'],
    totalAdditions: 20,
    totalDeletions: 8,
  },
];

export function useAIReview(_prNumber?: number): UseAIReviewReturn {
  void _prNumber
  const [items, setItems] = useState<AIReviewItem[]>([]);
  const [groups, setGroups] = useState<ChangeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingGroups, setIsGeneratingGroups] = useState(false);

  const triggerReview = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setItems(mockReviewItems);
    setIsLoading(false);
  }, []);

  const generateGroups = useCallback(async () => {
    setIsGeneratingGroups(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setGroups(mockGroups);
    setIsGeneratingGroups(false);
  }, []);

  return {
    items,
    groups,
    triggerReview,
    generateGroups,
    isLoading,
    isGeneratingGroups,
  };
}
