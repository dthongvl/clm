import type { StreamEvent } from '../services/ai-backend/index.js';

/**
 * A single chapter in a Notebook outline. Chapters have stable ids that are
 * preserved across per-chapter regeneration even if title or intent change.
 */
export interface NotebookChapter {
  id: string;
  title: string;
  intent: string;
}

/** Plain prose cell rendered as markdown. Auto-completes on viewport read. */
export interface NotebookMarkdownCell {
  type: 'markdown';
  id: string;
  content: string;
}

/**
 * Stable line-range descriptor for a diff highlight. Uses file path plus
 * old/new side-aware ranges so AI output matches against diff data without
 * depending on `@pierre/diffs` internal hunk indexing.
 */
export interface NotebookDiffHighlight {
  /** Side this highlight refers to. */
  side: 'additions' | 'deletions';
  /** Inclusive start line; uses new-line numbering for additions, old-line for deletions. */
  startLine: number;
  /** Inclusive end line. */
  endLine: number;
  /** Optional one-line annotation rendered alongside the highlight. */
  note?: string;
}

/** One-file diff reader cell that starts in highlighted-hunk mode. */
export interface NotebookDiffCell {
  type: 'diff';
  id: string;
  /** Repo-relative file path; must match a file in the PR diff. */
  filePath: string;
  /** Optional headline shown above the diff. */
  caption?: string;
  highlights: NotebookDiffHighlight[];
}

export type NotebookNoteSeverity =
  | 'info'
  | 'attention'
  | 'security'
  | 'performance'
  | 'risk';

/**
 * Note cell. `info` notes auto-complete on viewport read; all other severities
 * require explicit acknowledgment to count as complete.
 */
export interface NotebookNoteCell {
  type: 'note';
  id: string;
  severity: NotebookNoteSeverity;
  content: string;
}

export interface NotebookChecklistItem {
  id: string;
  text: string;
}

/** Checklist cell. Each item must be explicitly ticked to count as complete. */
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

/**
 * AI "needs your judgment" thread. Renders inline within the matching diff
 * cell via the shared annotation chrome, not as a standalone cell.
 */
export interface NotebookJudgmentThread {
  id: string;
  /** Chapter this thread is attached to. */
  chapterId: string;
  filePath: string;
  side: 'additions' | 'deletions';
  lineNumber: number;
  content: string;
  anchorReason: string;
}

/** A fully-emitted chapter (cells and any judgment threads anchored within). */
export interface NotebookChapterPayload {
  chapterId: string;
  cells: NotebookCell[];
  judgmentThreads: NotebookJudgmentThread[];
}

/** Aggregated Notebook used as the parser's whole-output value. */
export interface Notebook {
  overview: string;
  outline: NotebookChapter[];
  chapters: NotebookChapterPayload[];
}

// --- Stream events ---------------------------------------------------------

/**
 * Outline event emitted before any chapter content. Carries the full chapter
 * list so the client can render chapter shells while later cells stream in.
 */
export interface NotebookOutlineEvent {
  type: 'notebook_outline';
  overview: string;
  outline: NotebookChapter[];
}

/**
 * Chapter content event. Emitted once per chapter, carrying all cells and any
 * judgment threads anchored to lines within that chapter's diff cells.
 */
export interface NotebookChapterEvent {
  type: 'notebook_chapter';
  chapterId: string;
  cells: NotebookCell[];
  judgmentThreads: NotebookJudgmentThread[];
}

/**
 * Per-chapter failure event. Lets the client mark the chapter "partial/error"
 * while preserving outline and any chapters already emitted.
 */
export interface NotebookChapterErrorEvent {
  type: 'notebook_chapter_error';
  chapterId: string;
  error: string;
}

export type ReviewGuideStreamEvent =
  | StreamEvent
  | NotebookOutlineEvent
  | NotebookChapterEvent
  | NotebookChapterErrorEvent;
