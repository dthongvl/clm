export type Severity = 'critical' | 'warning' | 'info';

/** Which side of the diff the comment is on */
export type CommentSide = 'additions' | 'deletions';

export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number;
  /** Which side of the diff the comment is on (additions = right/new, deletions = left/old) */
  side: CommentSide;
  content: string;
  author: { type: 'human' | 'ai'; name: string; avatarUrl?: string };
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
