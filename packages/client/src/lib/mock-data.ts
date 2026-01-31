import type { PRInfo } from "@/types/pr"
import type { DiffFile } from "@/types/diff"
import type { ChangeGroup } from "@/types/grouping"
import type { AIReviewItem, ReviewComment } from "@/types/review"
import type { DiffFileData } from "@/components/diff-panel"

export const mockPR: PRInfo = {
  number: 42,
  title: "feat: Add AI-powered code review",
  author: { login: "octocat", avatarUrl: "https://github.com/octocat.png" },
  description: "This PR adds AI-powered code review functionality",
  baseBranch: "main",
  headBranch: "feature/ai-review",
  state: "open",
}

export const mockFileTree: DiffFile[] = [
  {
    path: "src/components/review-panel.tsx",
    status: "added",
    additions: 142,
    deletions: 0,
    hunks: [],
  },
  {
    path: "src/lib/ai-client.ts",
    status: "added",
    additions: 89,
    deletions: 0,
    hunks: [],
  },
  {
    path: "src/hooks/use-review.ts",
    status: "modified",
    additions: 23,
    deletions: 8,
    hunks: [],
  },
  {
    path: "src/types/review.ts",
    status: "modified",
    additions: 15,
    deletions: 3,
    hunks: [],
  },
  {
    path: "src/legacy/old-review.ts",
    status: "deleted",
    additions: 0,
    deletions: 156,
    hunks: [],
  },
  {
    path: "src/utils/helpers.ts",
    oldPath: "src/lib/helpers.ts",
    status: "renamed",
    additions: 2,
    deletions: 1,
    hunks: [],
  },
]

export const mockChangeGroups: ChangeGroup[] = [
  {
    id: "1",
    title: "AI Review Feature",
    summary:
      "Core AI-powered code review functionality including the review panel component and AI client integration.",
    files: ["src/components/review-panel.tsx", "src/lib/ai-client.ts"],
    totalAdditions: 231,
    totalDeletions: 0,
  },
  {
    id: "2",
    title: "Review Hook Improvements",
    summary:
      "Enhanced useReview hook with TypeScript types and callback support.",
    files: ["src/hooks/use-review.ts", "src/types/review.ts"],
    totalAdditions: 38,
    totalDeletions: 11,
  },
  {
    id: "3",
    title: "Code Cleanup",
    summary: "Removed legacy review module and reorganized utility helpers.",
    files: ["src/legacy/old-review.ts", "src/utils/helpers.ts"],
    totalAdditions: 2,
    totalDeletions: 157,
  },
]

export const mockAIReviewItems: AIReviewItem[] = [
  {
    id: "1",
    filePath: "src/lib/ai-client.ts",
    lineNumber: 45,
    severity: "critical",
    message: "API key is hardcoded in the source code",
    suggestion: "Use environment variables to store sensitive credentials",
  },
  {
    id: "2",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 12,
    severity: "warning",
    message: "Missing error handling for async operations",
    suggestion: "Add try-catch block and error state management",
  },
  {
    id: "3",
    filePath: "src/components/review-panel.tsx",
    lineNumber: 8,
    severity: "info",
    message: "Consider memoizing this component for better performance",
  },
  {
    id: "4",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 5,
    severity: "warning",
    message: "Dependency array may be missing dependencies",
  },
]

export const mockComments: ReviewComment[] = [
  {
    id: "comment-1",
    filePath: "src/components/review-panel.tsx",
    lineNumber: 4,
    content: "Consider adding prop types for better documentation and type safety.",
    author: { type: "ai", name: "AI Assistant" },
    severity: "info",
    createdAt: new Date("2024-01-15T10:30:00Z"),
    replies: [
      {
        id: "comment-1-reply-1",
        filePath: "src/components/review-panel.tsx",
        lineNumber: 4,
        content: "Good point! I'll add TypeScript interface for the props.",
        author: { type: "human", name: "octocat" },
        createdAt: new Date("2024-01-15T10:35:00Z"),
        replies: [],
      },
    ],
  },
  {
    id: "comment-2",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 6,
    content: "The useState generic type is correctly applied here. Nice TypeScript usage!",
    author: { type: "human", name: "reviewer123" },
    createdAt: new Date("2024-01-15T11:00:00Z"),
    replies: [],
  },
  {
    id: "comment-3",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 8,
    content: "This callback could cause memory leaks if the component unmounts during an async operation. Consider adding cleanup logic.",
    author: { type: "ai", name: "AI Assistant" },
    severity: "warning",
    createdAt: new Date("2024-01-15T11:15:00Z"),
    replies: [],
  },
]

export const mockDiffFiles: DiffFileData[] = [
  {
    path: "src/components/review-panel.tsx",
    status: "added",
    additions: 5,
    deletions: 0,
    oldContent: "",
    newContent: `import React from 'react';

export function ReviewPanel() {
  return <div className="review-panel">Review Panel</div>;
}`,
  },
  {
    path: "src/hooks/use-review.ts",
    status: "modified",
    additions: 3,
    deletions: 2,
    oldContent: `import { useState } from 'react';

export function useReview() {
  const [reviews, setReviews] = useState([]);
  return { reviews };
}`,
    newContent: `import { useState, useCallback } from 'react';
import type { Review } from '../types';

export function useReview() {
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const addReview = useCallback((review: Review) => {
    setReviews((prev) => [...prev, review]);
  }, []);

  return { reviews, addReview };
}`,
  },
  {
    path: "src/legacy/old-review.ts",
    status: "deleted",
    additions: 0,
    deletions: 3,
    oldContent: `// Legacy review module
export const legacyReview = () => {};
export default legacyReview;`,
    newContent: "",
  },
]
