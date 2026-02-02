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

export interface PRCommentResponse {
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DraftComment {
  id: string;
  prNumber: number;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  authorName: string;
  createdAt: string;
}

export interface ChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
}

export interface GroupingResult {
  groups: ChangeGroup[];
}

export interface AIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
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
