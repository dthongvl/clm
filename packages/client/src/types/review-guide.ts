import type { CommentSide, ReviewComment } from './review';
import type { ServerNotebookNoteSeverity } from '@/api/ai';

export type NoteSeverity = ServerNotebookNoteSeverity;

/** Outline-level chapter description (no cells). */
export interface NotebookChapter {
  id: string;
  title: string;
  intent: string;
}

export interface NotebookMarkdownCell {
  type: 'markdown';
  id: string;
  content: string;
}

export interface NotebookDiffHighlight {
  side: CommentSide;
  startLine: number;
  endLine: number;
  note?: string;
}

export interface NotebookDiffCell {
  type: 'diff';
  id: string;
  filePath: string;
  caption?: string;
  highlights: NotebookDiffHighlight[];
}

export interface NotebookNoteCell {
  type: 'note';
  id: string;
  severity: NoteSeverity;
  content: string;
}

export interface NotebookChecklistItem {
  id: string;
  text: string;
}

export interface NotebookChecklistCell {
  type: 'checklist';
  id: string;
  items: NotebookChecklistItem[];
}

export type NotebookCell =
  | NotebookMarkdownCell
  | NotebookDiffCell
  | NotebookNoteCell
  | NotebookChecklistCell;

/** Lifecycle status for one chapter's content generation. */
export type ChapterStatus = 'pending' | 'generating' | 'complete' | 'partial' | 'error';

export interface NotebookChapterState {
  chapter: NotebookChapter;
  status: ChapterStatus;
  cells: NotebookCell[];
  error?: string;
}

/**
 * Client-side AI judgment thread. Mirrors the server thread plus client-only
 * lifecycle fields (pin/resolve/replies/createdAt). Anchored inline within a
 * diff cell via the shared annotation chrome (rendered through the diff
 * renderer, not as a standalone notebook cell).
 */
export interface NotebookJudgmentThread {
  id: string;
  chapterId: string;
  filePath: string;
  side: CommentSide;
  lineNumber: number;
  content: string;
  anchorReason: string;
  source: 'ai-judgment';
  pinned: boolean;
  resolved: boolean;
  replies: ReviewComment[];
  createdAt: Date;
}

/**
 * Orphan archive entry — a preserved thread whose anchor (file/line/side) is
 * no longer present after regeneration. Archive entries never affect
 * completion in v1.
 */
export interface NotebookOrphanThread {
  thread: NotebookJudgmentThread;
  /** The chapterId the orphan was last attached to. */
  originChapterId: string;
  archivedAt: Date;
}

/** Per-cell/per-item completion state (client-local). */
export interface NotebookCompletionState {
  /** Explicitly-acknowledged note cells (attention/security/performance/risk). */
  acknowledgedNoteIds: string[];
  /** Explicitly-ticked checklist items, keyed by cellId+itemId composite. */
  checkedChecklistItemIds: string[];
}

/** Cache value at TanStack Query key `['review-guide']`. */
export interface NotebookState {
  overview: string;
  chapters: NotebookChapterState[];
  threads: NotebookJudgmentThread[];
  orphans: NotebookOrphanThread[];
  completion: NotebookCompletionState;
}
