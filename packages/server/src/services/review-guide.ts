import type {
  Notebook,
  NotebookCell,
  NotebookChapter,
  NotebookChapterPayload,
  NotebookChecklistCell,
  NotebookChecklistItem,
  NotebookDiffCell,
  NotebookDiffHighlight,
  NotebookJudgmentThread,
  NotebookMarkdownCell,
  NotebookNoteCell,
  NotebookNoteSeverity,
  ReviewGuideStreamEvent,
} from '../types/review-guide.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend } from './ai-backend/index.js';
import {
  buildChapterRegenerationPrompt,
  buildReviewGuidePrompt,
} from './review-guide-prompt.js';
import {
  getModelForAction,
  getThinkingLevelForAction,
  getVariantForAction,
  type ThinkingLevel,
} from './settings.js';
import { logger } from '../lib/logger.js';

/**
 * Streaming Notebook generation for a PR.
 *
 * The single-prompt AI call produces the full notebook JSON; this generator
 * forwards backend status/thinking/text events as they arrive and, after the
 * backend's terminal `done`, parses the buffer and emits Notebook-shaped
 * events in reading order:
 *
 *   notebook_outline → notebook_chapter (× N) → done
 *
 * On parse failure the generator emits an `error` and stops without erasing
 * any partial outline/chapter state already emitted.
 */
export async function* generateReviewGuideStream(
  prLink: string,
  additionalContext?: string,
): AsyncGenerator<ReviewGuideStreamEvent> {
  let prompt: string;
  let model: string | undefined;
  let variant: string | undefined;
  let thinkingLevel: ThinkingLevel | undefined;
  try {
    prompt = buildReviewGuidePrompt({ prLink, additionalContext });
    model = await getModelForAction('review-guide');
    variant = await getVariantForAction('review-guide');
    thinkingLevel = await getThinkingLevelForAction('review-guide');
  } catch (error) {
    logger.error('Notebook setup failed', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  let buffer = '';
  try {
    for await (const event of getAiBackend().promptStream(prompt, {
      model,
      variant,
      thinkingLevel,
    })) {
      if (event.type === 'text' && typeof event.content === 'string') {
        buffer += event.content;
        yield event;
        continue;
      }

      if (event.type === 'done') {
        break;
      }

      if (event.type === 'error') {
        yield event;
        return;
      }

      yield event;
    }
  } catch (error) {
    logger.error('Notebook stream failed', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  const notebook = parseNotebookOutput(buffer);

  yield {
    type: 'notebook_outline',
    overview: notebook.overview,
    outline: notebook.outline,
  };

  for (const chapter of notebook.chapters) {
    yield {
      type: 'notebook_chapter',
      chapterId: chapter.chapterId,
      cells: chapter.cells,
      judgmentThreads: chapter.judgmentThreads,
    };
  }

  yield { type: 'done' };
}

/**
 * Streaming per-chapter regeneration. Emits a single `notebook_chapter` event
 * (preserving the requested chapterId) followed by `done`. On parse failure
 * emits `notebook_chapter_error` so the client can mark the chapter partial.
 */
export async function* generateChapterRegenerationStream(
  prLink: string,
  chapter: { id: string; title: string; intent: string },
  outlineContext: NotebookChapter[],
  additionalContext?: string,
): AsyncGenerator<ReviewGuideStreamEvent> {
  let prompt: string;
  let model: string | undefined;
  let variant: string | undefined;
  let thinkingLevel: ThinkingLevel | undefined;
  try {
    prompt = buildChapterRegenerationPrompt({
      prLink,
      chapter,
      outlineContext,
      additionalContext,
    });
    model = await getModelForAction('review-guide');
    variant = await getVariantForAction('review-guide');
    thinkingLevel = await getThinkingLevelForAction('review-guide');
  } catch (error) {
    logger.error('Chapter regeneration setup failed', error);
    yield {
      type: 'notebook_chapter_error',
      chapterId: chapter.id,
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  let buffer = '';
  try {
    for await (const event of getAiBackend().promptStream(prompt, {
      model,
      variant,
      thinkingLevel,
    })) {
      if (event.type === 'text' && typeof event.content === 'string') {
        buffer += event.content;
        yield event;
        continue;
      }

      if (event.type === 'done') {
        break;
      }

      if (event.type === 'error') {
        yield {
          type: 'notebook_chapter_error',
          chapterId: chapter.id,
          error: event.error,
        };
        return;
      }

      yield event;
    }
  } catch (error) {
    logger.error('Chapter regeneration stream failed', error);
    yield {
      type: 'notebook_chapter_error',
      chapterId: chapter.id,
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  const payload = parseChapterRegenerationOutput(buffer, chapter.id);
  if (!payload) {
    yield {
      type: 'notebook_chapter_error',
      chapterId: chapter.id,
      error: 'Failed to parse regenerated chapter',
    };
    return;
  }

  yield {
    type: 'notebook_chapter',
    chapterId: payload.chapterId,
    cells: payload.cells,
    judgmentThreads: payload.judgmentThreads,
  };
  yield { type: 'done' };
}

// --- Parsing ---------------------------------------------------------------

interface JsonChapter {
  id?: string;
  title?: string;
  intent?: string;
}

interface JsonHighlight {
  side?: string;
  startLine?: unknown;
  endLine?: unknown;
  note?: string;
}

interface JsonCell {
  type?: string;
  id?: string;
  content?: string;
  filePath?: string;
  caption?: string;
  highlights?: JsonHighlight[];
  severity?: string;
  items?: Array<{ id?: string; text?: string }>;
}

interface JsonJudgmentThread {
  id?: string;
  chapterId?: string;
  filePath?: string;
  side?: string;
  lineNumber?: unknown;
  content?: string;
  anchorReason?: string;
}

interface JsonChapterPayload {
  chapterId?: string;
  chapter?: { id?: string; title?: string; intent?: string };
  cells?: JsonCell[];
  judgmentThreads?: JsonJudgmentThread[];
}

interface JsonNotebook {
  overview?: string;
  outline?: JsonChapter[];
  chapters?: JsonChapterPayload[];
}

const VALID_NOTE_SEVERITIES: readonly NotebookNoteSeverity[] = [
  'info',
  'attention',
  'security',
  'performance',
  'risk',
];

const EMPTY_NOTEBOOK: Notebook = {
  overview: '',
  outline: [],
  chapters: [],
};

export function parseNotebookOutput(output: string): Notebook {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) {
    logger.warn('No JSON notebook found in AI output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return EMPTY_NOTEBOOK;
  }
  const parsed = parseJsonSafe<JsonNotebook>(jsonContent);
  if (!parsed || typeof parsed !== 'object') {
    logger.warn('Invalid JSON structure in notebook response');
    return EMPTY_NOTEBOOK;
  }

  const outline = parseOutline(parsed.outline);
  const chapters = parseChapters(parsed.chapters, outline);

  return {
    overview: typeof parsed.overview === 'string' ? parsed.overview : '',
    outline,
    chapters,
  };
}

/**
 * Parse a per-chapter regeneration response. The response is a single chapter
 * payload object. Returns `null` on unrecoverable parse failure.
 */
export function parseChapterRegenerationOutput(
  output: string,
  expectedChapterId: string,
): NotebookChapterPayload | null {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) return null;
  const parsed = parseJsonSafe<JsonChapterPayload>(jsonContent);
  if (!parsed || typeof parsed !== 'object') return null;

  // Accept either { chapterId, ... } or { chapter: { id, ... }, ... }.
  const chapterId =
    typeof parsed.chapterId === 'string' && parsed.chapterId.length > 0
      ? parsed.chapterId
      : typeof parsed.chapter?.id === 'string' && parsed.chapter.id.length > 0
        ? parsed.chapter.id
        : expectedChapterId;

  // The chapter id must be preserved; if AI dropped or renamed it, force the
  // expected id so client cache reconciliation works.
  const finalChapterId = expectedChapterId;
  if (chapterId !== expectedChapterId) {
    logger.warn(
      `Regenerated chapter id mismatch (got "${chapterId}", expected "${expectedChapterId}"); coercing`,
    );
  }

  const chapterIndex = chapterIndexFromId(finalChapterId);
  const cells = parseCells(parsed.cells, chapterIndex);
  const judgmentThreads = parseJudgmentThreads(parsed.judgmentThreads, finalChapterId);

  return {
    chapterId: finalChapterId,
    cells,
    judgmentThreads,
  };
}

function parseOutline(jsonOutline: JsonChapter[] | undefined): NotebookChapter[] {
  if (!Array.isArray(jsonOutline)) return [];
  return jsonOutline.map((chapter, index) => ({
    id:
      typeof chapter.id === 'string' && chapter.id.length > 0
        ? chapter.id
        : `chapter-${index + 1}`,
    title: typeof chapter.title === 'string' ? chapter.title : `Chapter ${index + 1}`,
    intent: typeof chapter.intent === 'string' ? chapter.intent : '',
  }));
}

function parseChapters(
  jsonChapters: JsonChapterPayload[] | undefined,
  outline: NotebookChapter[],
): NotebookChapterPayload[] {
  if (!Array.isArray(jsonChapters)) return [];
  return jsonChapters.map((chapter, index) => {
    const idFromPayload =
      typeof chapter.chapterId === 'string' && chapter.chapterId.length > 0
        ? chapter.chapterId
        : typeof chapter.chapter?.id === 'string' && chapter.chapter.id.length > 0
          ? chapter.chapter.id
          : null;
    const idFromOutline = outline[index]?.id ?? null;
    const chapterId = idFromPayload ?? idFromOutline ?? `chapter-${index + 1}`;
    const chapterIndex = chapterIndexFromId(chapterId, index);
    return {
      chapterId,
      cells: parseCells(chapter.cells, chapterIndex),
      judgmentThreads: parseJudgmentThreads(chapter.judgmentThreads, chapterId),
    };
  });
}

function chapterIndexFromId(chapterId: string, fallback = 0): number {
  const m = chapterId.match(/(\d+)$/);
  if (!m) return fallback;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback + 1;
}

function parseCells(jsonCells: JsonCell[] | undefined, chapterIndex: number): NotebookCell[] {
  if (!Array.isArray(jsonCells)) return [];
  const out: NotebookCell[] = [];
  jsonCells.forEach((cell, cellIndex) => {
    const fallbackId = `cell-${chapterIndex || 1}-${cellIndex + 1}`;
    const id = typeof cell.id === 'string' && cell.id.length > 0 ? cell.id : fallbackId;

    switch (cell.type) {
      case 'markdown': {
        const md: NotebookMarkdownCell = {
          type: 'markdown',
          id,
          content: typeof cell.content === 'string' ? cell.content : '',
        };
        out.push(md);
        return;
      }
      case 'diff': {
        if (typeof cell.filePath !== 'string' || cell.filePath.length === 0) {
          // Downgrade to a markdown placeholder so the client can show a warning
          // instead of crashing on a malformed diff cell.
          out.push({
            type: 'markdown',
            id,
            content: '_Diff cell skipped: missing file path._',
          });
          return;
        }
        const diff: NotebookDiffCell = {
          type: 'diff',
          id,
          filePath: cell.filePath,
          caption: typeof cell.caption === 'string' ? cell.caption : undefined,
          highlights: parseHighlights(cell.highlights),
        };
        out.push(diff);
        return;
      }
      case 'note': {
        const severity = parseSeverity(cell.severity);
        const note: NotebookNoteCell = {
          type: 'note',
          id,
          severity,
          content: typeof cell.content === 'string' ? cell.content : '',
        };
        out.push(note);
        return;
      }
      case 'checklist': {
        const items = parseChecklistItems(cell.items, id);
        const checklist: NotebookChecklistCell = {
          type: 'checklist',
          id,
          items,
        };
        out.push(checklist);
        return;
      }
      default: {
        // Unknown cell type — downgrade to markdown so partial state survives.
        if (typeof cell.content === 'string' && cell.content.length > 0) {
          out.push({ type: 'markdown', id, content: cell.content });
        }
        return;
      }
    }
  });
  return out;
}

function parseSeverity(raw: unknown): NotebookNoteSeverity {
  if (typeof raw !== 'string') return 'info';
  const normalized = raw.toLowerCase();
  if ((VALID_NOTE_SEVERITIES as readonly string[]).includes(normalized)) {
    return normalized as NotebookNoteSeverity;
  }
  return 'info';
}

function parseHighlights(
  jsonHighlights: JsonHighlight[] | undefined,
): NotebookDiffHighlight[] {
  if (!Array.isArray(jsonHighlights)) return [];
  const out: NotebookDiffHighlight[] = [];
  jsonHighlights.forEach((h) => {
    const start = typeof h.startLine === 'number' ? h.startLine : Number(h.startLine);
    const end = typeof h.endLine === 'number' ? h.endLine : Number(h.endLine);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const sideRaw = typeof h.side === 'string' ? h.side : 'additions';
    const side: 'additions' | 'deletions' =
      sideRaw === 'deletions' ? 'deletions' : 'additions';
    out.push({
      side,
      startLine: Math.min(start, end),
      endLine: Math.max(start, end),
      note: typeof h.note === 'string' ? h.note : undefined,
    });
  });
  return out;
}

function parseChecklistItems(
  jsonItems: Array<{ id?: string; text?: string }> | undefined,
  cellId: string,
): NotebookChecklistItem[] {
  if (!Array.isArray(jsonItems)) return [];
  const out: NotebookChecklistItem[] = [];
  jsonItems.forEach((item, index) => {
    if (typeof item.text !== 'string' || item.text.length === 0) return;
    out.push({
      id:
        typeof item.id === 'string' && item.id.length > 0
          ? item.id
          : `${cellId}-item-${index + 1}`,
      text: item.text,
    });
  });
  return out;
}

function parseJudgmentThreads(
  jsonThreads: JsonJudgmentThread[] | undefined,
  chapterId: string,
): NotebookJudgmentThread[] {
  if (!Array.isArray(jsonThreads)) return [];
  const out: NotebookJudgmentThread[] = [];
  jsonThreads.forEach((t, index) => {
    if (typeof t.filePath !== 'string' || t.filePath.length === 0) return;
    if (typeof t.lineNumber !== 'number' || !Number.isFinite(t.lineNumber)) return;
    if (typeof t.content !== 'string' || t.content.length === 0) return;
    const sideRaw = typeof t.side === 'string' ? t.side : 'additions';
    const side: 'additions' | 'deletions' =
      sideRaw === 'deletions' ? 'deletions' : 'additions';
    out.push({
      id: typeof t.id === 'string' && t.id.length > 0 ? t.id : `jt-${chapterId}-${index + 1}`,
      chapterId,
      filePath: t.filePath,
      side,
      lineNumber: t.lineNumber,
      content: t.content,
      anchorReason: typeof t.anchorReason === 'string' ? t.anchorReason : '',
    });
  });
  return out;
}
