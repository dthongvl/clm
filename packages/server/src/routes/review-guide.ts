import { Hono } from 'hono';
import {
  generateChapterRegenerationStream,
  generateReviewGuideStream,
} from '../services/review-guide.js';
import type { NotebookChapter } from '../types/review-guide.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, normalizeAdditionalContext } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';
import { streamAiResponse } from '../utils/sse.js';

interface AIActionBody {
  additionalContext?: unknown;
}

interface ChapterRegenerationBody {
  chapterId?: unknown;
  title?: unknown;
  intent?: unknown;
  outlineContext?: unknown;
  additionalContext?: unknown;
}

const app = new Hono();

// POST /api/ai/review-guide/stream
//
// Backs the Notebook UI (the action key remains `review-guide` for compat
// with persisted user model preferences). Server-Sent Events: emits status,
// thinking, tool_use, tool_result, and text events as the agent works,
// then emits one `notebook_outline` event followed by a `notebook_chapter`
// event per chapter, and finally a terminal `done` (or `error`).
app.post('/stream', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<AIActionBody>(c);
  if (!result.ok) return result.response;

  const contextResult = normalizeAdditionalContext(result.data.additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  const prLink = buildPRLink(repo, prNumber);
  const additionalContext = contextResult.value;
  logger.ai(`Streaming Notebook for PR #${prNumber}`);

  return streamAiResponse(c, () => generateReviewGuideStream(prLink, additionalContext));
});

// POST /api/ai/review-guide/chapter/stream
//
// Per-chapter regeneration. Body: { chapterId, title, intent, outlineContext,
// additionalContext? }. Emits a single `notebook_chapter` event preserving the
// requested chapterId, then `done`. On failure emits `notebook_chapter_error`
// followed by `done`.
app.post('/chapter/stream', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<ChapterRegenerationBody>(c);
  if (!result.ok) return result.response;

  const { chapterId, title, intent, outlineContext, additionalContext } = result.data;

  if (typeof chapterId !== 'string' || chapterId.length === 0) {
    return c.json({ error: 'chapterId is required' }, 400);
  }
  if (typeof title !== 'string' || title.length === 0) {
    return c.json({ error: 'title is required' }, 400);
  }
  if (typeof intent !== 'string') {
    return c.json({ error: 'intent is required' }, 400);
  }

  const outline = parseOutlineContext(outlineContext);

  const contextResult = normalizeAdditionalContext(additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  const prLink = buildPRLink(repo, prNumber);
  logger.ai(`Regenerating Notebook chapter ${chapterId} for PR #${prNumber}`);

  return streamAiResponse(c, () =>
    generateChapterRegenerationStream(
      prLink,
      { id: chapterId, title, intent },
      outline,
      contextResult.value,
    ),
  );
});

function parseOutlineContext(raw: unknown): NotebookChapter[] {
  if (!Array.isArray(raw)) return [];
  const out: NotebookChapter[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { id?: unknown; title?: unknown; intent?: unknown };
    if (typeof e.id !== 'string' || e.id.length === 0) continue;
    out.push({
      id: e.id,
      title: typeof e.title === 'string' ? e.title : '',
      intent: typeof e.intent === 'string' ? e.intent : '',
    });
  }
  return out;
}

export default app;
