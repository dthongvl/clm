export type Severity = 'critical' | 'warning' | 'info';

export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number;
  content: string;
  author: { type: 'human' | 'ai'; name: string };
  severity?: Severity;
  createdAt: Date;
  replies: ReviewComment[];
  resolved?: boolean;
  /** Whether this comment is currently being streamed */
  isStreaming?: boolean;
}

export interface AIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: Severity;
  message: string;
  suggestion?: string;
}
