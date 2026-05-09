import type { StreamEvent } from '../services/ai-backend/index.js';

export interface ReviewGuideStep {
  id: string;
  title: string;
  fileGroup: string[];
  rationale: string;
  lookFor: string;
}

export interface ReviewGuideJudgmentThread {
  id: string;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  anchorReason: string;
}

export interface ReviewGuide {
  overview: string;
  steps: ReviewGuideStep[];
  judgmentThreads: ReviewGuideJudgmentThread[];
}

export interface ReviewGuideResultEvent {
  type: 'result';
  result: ReviewGuide;
}

export type ReviewGuideStreamEvent = StreamEvent | ReviewGuideResultEvent;
