import type { AIReviewCategory } from '@/types/review';

export interface ServerChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: 'high' | 'medium' | 'low';
  riskReason?: string;
}

export interface ServerAIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  categories?: AIReviewCategory[];
}

export interface AIReviewPRResponse {
  items: ServerAIReviewItem[];
  summary: string;
}

// --- Notebook wire types ---------------------------------------------------

export interface ServerNotebookChapter {
  id: string;
  title: string;
  intent: string;
}

export interface ServerNotebookDiffHighlight {
  side: 'additions' | 'deletions';
  startLine: number;
  endLine: number;
  note?: string;
}

export interface ServerNotebookMarkdownCell {
  type: 'markdown';
  id: string;
  content: string;
}

export interface ServerNotebookDiffCell {
  type: 'diff';
  id: string;
  filePath: string;
  caption?: string;
  highlights: ServerNotebookDiffHighlight[];
}

export type ServerNotebookNoteSeverity =
  | 'info'
  | 'attention'
  | 'security'
  | 'performance'
  | 'risk';

export interface ServerNotebookNoteCell {
  type: 'note';
  id: string;
  severity: ServerNotebookNoteSeverity;
  content: string;
}

export interface ServerNotebookChecklistItem {
  id: string;
  text: string;
}

export interface ServerNotebookChecklistCell {
  type: 'checklist';
  id: string;
  items: ServerNotebookChecklistItem[];
}

export type ServerNotebookCell =
  | ServerNotebookMarkdownCell
  | ServerNotebookDiffCell
  | ServerNotebookNoteCell
  | ServerNotebookChecklistCell;

export interface ServerNotebookJudgmentThread {
  id: string;
  chapterId: string;
  filePath: string;
  side: 'additions' | 'deletions';
  lineNumber: number;
  content: string;
  anchorReason: string;
}

export interface ServerNotebookChapterPayload {
  chapterId: string;
  cells: ServerNotebookCell[];
  judgmentThreads: ServerNotebookJudgmentThread[];
}

export {
  streamAiReview,
  streamAiGrouping,
  streamAiReviewGuide,
  streamAiNotebookChapter,
  type StreamEvent,
  type StreamStatusEvent,
  type StreamStatusPhase,
  type StreamThinkingEvent,
  type StreamToolUseEvent,
  type StreamToolResultEvent,
  type StreamTextEvent,
  type StreamTokenUsageEvent,
  type StreamDoneEvent,
  type StreamErrorEvent,
  type ReviewStreamEvent,
  type ReviewResultEvent,
  type GroupingStreamEvent,
  type GroupingResultEvent,
  type ReviewGuideStreamEvent,
  type NotebookOutlineEvent,
  type NotebookChapterEvent,
  type NotebookChapterErrorEvent,
  type StreamRequestBody,
  type ChapterRegenerationRequestBody,
} from './ai-stream';
