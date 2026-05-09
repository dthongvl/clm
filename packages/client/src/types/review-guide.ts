import type { CommentSide, ReviewComment } from './review';

export interface ReviewGuideStep {
  id: string;
  title: string;
  fileGroup: string[];
  rationale: string;
  lookFor: string;
}

/** Guide content as produced by the AI (without thread lifecycle state). */
export interface ReviewGuide {
  overview: string;
  steps: ReviewGuideStep[];
}

/**
 * Client-side AI judgment thread. Distinct from `ReviewComment` because it
 * carries AI-specific lifecycle (pinning across regeneration, anchorReason,
 * provenance source). Replies reuse `ReviewComment` so the existing inline
 * thread UI renders them unchanged.
 */
export interface JudgmentThread {
  id: string;
  filePath: string;
  lineNumber: number;
  side: CommentSide;
  content: string;
  /** AI's stated reason it could not decide without team or product context. */
  anchorReason: string;
  source: 'ai-judgment';
  pinned: boolean;
  resolved: boolean;
  replies: ReviewComment[];
  createdAt: Date;
}

/** Cache value at TanStack Query key `['review-guide']`. */
export interface ReviewGuideState {
  guide: ReviewGuide | null;
  /** Stable order; serialize-friendly. */
  reviewedStepIds: string[];
  currentStepId: string | null;
  /** Includes pinned + replies. */
  threads: JudgmentThread[];
}
