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
