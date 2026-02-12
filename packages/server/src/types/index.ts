export interface PRInfo {
  number: number;
  title: string;
  author: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  repo: string;
}

export interface FileDiff {
  filename: string;
  oldFilename?: string;  // For renamed files, the original filename
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  baseContent?: string;
  headContent?: string;
}

export interface Comment {
  id: string;
  file: string;
  line: number;
  body: string;
  author: string;
  createdAt: string;
  replies?: Comment[];
}

export interface PRComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  path?: string;
  line?: number;
  original_line?: number;
  side?: 'LEFT' | 'RIGHT';
  in_reply_to_id?: number;
  diff_hunk?: string;
}

export interface AIReviewSuggestion {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'info';
  comment: string;
  code?: string;
}

export interface AIReviewResult {
  suggestions: AIReviewSuggestion[];
  summary?: string;
}

export type RiskLevel = 'high' | 'medium' | 'low';

export interface ChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: RiskLevel;
  riskReason?: string;
}

export interface GroupingResult {
  groups: ChangeGroup[];
}

export type AIReviewCategory =
  | "code-quality"
  | "coding-convention"
  | "security"
  | "accessibility"
  | "architecture"
  | "api-design"
  | "performance"
  | "testing";

export type AIReviewRunMode = "combined" | "separate";

export interface AIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  categories: AIReviewCategory[];
}

export interface AIReviewPRResult {
  items: AIReviewItem[];
  summary: string;
}

export interface RelatedFile {
  filePath: string;
  explanation: string;
}

export interface RelatedFilesResult {
  files: RelatedFile[];
}

export interface PatternLocation {
  filePath: string;
  lineNumber: number;
  status: 'updated' | 'missing' | 'suspicious';
  snippet?: string;
}

export interface PatternVerification {
  id: string;
  pattern: string;
  description: string;
  status: 'verified' | 'incomplete' | 'warning';
  details: string;
  locations: PatternLocation[];
}

export interface PatternVerificationResult {
  verifications: PatternVerification[];
  summary: string;
}

export type SubmitReviewEvent = 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE';

export interface DraftReview {
  id: string;
  state: 'PENDING';
}

export interface DraftReviewComment {
  id: string;
  nodeId: string;
  reviewId: string;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  authorName: string;
  authorAvatarUrl: string;
  createdAt: string;
}

// GitHub's viewer viewed state for PR files
export type ViewedState = 'VIEWED' | 'UNVIEWED' | 'DISMISSED';

export interface ViewedFileState {
  path: string;
  state: ViewedState;
}
