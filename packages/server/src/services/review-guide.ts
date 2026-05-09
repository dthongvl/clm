import type {
  ReviewGuide,
  ReviewGuideJudgmentThread,
  ReviewGuideStep,
  ReviewGuideStreamEvent,
} from '../types/review-guide.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend } from './ai-backend/index.js';
import { buildReviewGuidePrompt } from './review-guide-prompt.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';

/**
 * Streaming Review Guide for a PR.
 *
 * Forwards every event from `AiBackend.promptStream` and accumulates assistant
 * text into a buffer. On the backend's terminal `done`, parses the buffer and
 * yields a `result` event with the structured guide followed by `done`. On
 * the backend's `error`, yields the error and stops without yielding a result.
 *
 * The backend's terminal `done` is *not* re-yielded — consumers see exactly
 * one terminal event (`result` then `done`, or `error`).
 */
export async function* generateReviewGuideStream(
  prLink: string,
  additionalContext?: string,
): AsyncGenerator<ReviewGuideStreamEvent> {
  let prompt: string;
  let model: string | undefined;
  let variant: string | undefined;
  try {
    prompt = buildReviewGuidePrompt({ prLink, additionalContext });
    model = await getModelForAction('review-guide');
    variant = await getVariantForAction('review-guide');
  } catch (error) {
    logger.error('Review guide setup failed', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  let buffer = '';
  try {
    for await (const event of getAiBackend().promptStream(prompt, { model, variant })) {
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
    logger.error('Review guide stream failed', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  const result = parseReviewGuideOutput(buffer);
  yield { type: 'result', result };
  yield { type: 'done' };
}

interface JsonStep {
  id?: string;
  title?: string;
  fileGroup?: unknown;
  rationale?: string;
  lookFor?: string;
}

interface JsonJudgmentThread {
  id?: string;
  filePath?: string;
  lineNumber?: unknown;
  side?: string;
  content?: string;
  anchorReason?: string;
}

interface JsonReviewGuide {
  overview?: string;
  steps?: JsonStep[];
  judgmentThreads?: JsonJudgmentThread[];
}

const EMPTY_GUIDE: ReviewGuide = { overview: '', steps: [], judgmentThreads: [] };

export function parseReviewGuideOutput(output: string): ReviewGuide {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) {
    logger.warn('No JSON review guide found in AI output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return EMPTY_GUIDE;
  }
  const parsed = parseJsonSafe<JsonReviewGuide>(jsonContent);
  if (!parsed || typeof parsed !== 'object') {
    logger.warn('Invalid JSON structure in review guide response');
    return EMPTY_GUIDE;
  }

  return {
    overview: typeof parsed.overview === 'string' ? parsed.overview : '',
    steps: Array.isArray(parsed.steps) ? parseSteps(parsed.steps) : [],
    judgmentThreads: Array.isArray(parsed.judgmentThreads)
      ? parseJudgmentThreads(parsed.judgmentThreads)
      : [],
  };
}

function parseSteps(jsonSteps: JsonStep[]): ReviewGuideStep[] {
  return jsonSteps.map((step, index) => {
    const fileGroup = Array.isArray(step.fileGroup)
      ? step.fileGroup.filter((p): p is string => typeof p === 'string')
      : [];
    return {
      id: step.id || `step-${index + 1}`,
      title: step.title || 'Unnamed Step',
      fileGroup,
      rationale: step.rationale || '',
      lookFor: step.lookFor || '',
    };
  });
}

function parseJudgmentThreads(jsonThreads: JsonJudgmentThread[]): ReviewGuideJudgmentThread[] {
  const threads: ReviewGuideJudgmentThread[] = [];
  jsonThreads.forEach((thread, index) => {
    if (typeof thread.filePath !== 'string' || thread.filePath.length === 0) {
      return;
    }
    if (typeof thread.lineNumber !== 'number' || !Number.isFinite(thread.lineNumber)) {
      return;
    }
    if (typeof thread.content !== 'string' || thread.content.length === 0) {
      return;
    }
    const sideRaw = typeof thread.side === 'string' ? thread.side : 'additions';
    const side: 'additions' | 'deletions' = sideRaw === 'deletions' ? 'deletions' : 'additions';
    threads.push({
      id: thread.id || `jt-${index + 1}`,
      filePath: thread.filePath,
      lineNumber: thread.lineNumber,
      side,
      content: thread.content,
      anchorReason: typeof thread.anchorReason === 'string' ? thread.anchorReason : '',
    });
  });
  return threads;
}
