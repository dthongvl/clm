import type { AIReviewItem, AIReviewPRResult, AIReviewCategory } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend, type StreamEvent } from './ai-backend/index.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { buildReviewPrompt } from './ai-review-prompt.js';

export interface GeneratePRReviewOptions {
  additionalContext?: string;
}

/** Service-layer terminal event carrying the parsed structured review. */
export interface ReviewResultEvent {
  type: 'result';
  result: AIReviewPRResult;
}

/**
 * Events emitted by {@link generatePRReviewStream}: every backend `StreamEvent`
 * passes through, plus a terminal `result` event with the parsed JSON review.
 */
export type ReviewStreamEvent = StreamEvent | ReviewResultEvent;

/**
 * Streaming AI code review for a PR.
 *
 * Forwards every event from `AiBackend.promptStream` (status / thinking /
 * tool_use / tool_result / text deltas) and accumulates assistant text into a
 * buffer. On the backend's terminal `done`, parses the buffer and yields a
 * `result` event with the structured review followed by a `done`. On the
 * backend's `error`, yields the error and stops without yielding a result.
 *
 * The backend's terminal `done` is *not* re-yielded — consumers see exactly
 * one terminal event (`result` then `done`, or `error`).
 */
export async function* generatePRReviewStream(
  prLink: string,
  options: GeneratePRReviewOptions = {},
): AsyncGenerator<ReviewStreamEvent> {
  const { additionalContext } = options;

  let prompt: string;
  let model: string | undefined;
  let variant: string | undefined;
  try {
    prompt = buildReviewPrompt({ prLink, additionalContext });
    model = await getModelForAction('ai-review');
    variant = await getVariantForAction('ai-review');
  } catch (error) {
    logger.error('AI review setup failed', error);
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
        // Swallow the backend's done — we emit our own terminal sequence below.
        break;
      }

      if (event.type === 'error') {
        // Surface and stop; do not synthesize a result on error.
        yield event;
        return;
      }

      yield event;
    }
  } catch (error) {
    logger.error('AI review stream failed', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  const result = parseReviewOutput(buffer);
  yield { type: 'result', result };
  yield { type: 'done' };
}

interface JsonReviewItem {
  severity?: string;
  file_path?: string;
  filePath?: string;
  line_number?: number;
  lineNumber?: number;
  message?: string;
  suggestion?: string;
  categories?: string[];
}

interface JsonReviewResult {
  summary?: string;
  items?: JsonReviewItem[];
}

function parseReviewOutput(output: string): AIReviewPRResult {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) {
    logger.warn('No JSON review found in AI output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return { items: [], summary: '' };
  }
  const parsed = parseJsonSafe<JsonReviewResult>(jsonContent);
  if (!parsed) {
    logger.error('Failed to parse review JSON', new Error('JSON parse failed'));
    return { items: [], summary: '' };
  }

  const summary = parsed.summary || '';
  const items = parseJsonReviewItems(parsed.items || []);

  return { items, summary };
}

function parseJsonReviewItems(jsonItems: JsonReviewItem[]): AIReviewItem[] {
  if (!Array.isArray(jsonItems)) {
    return [];
  }

  const items: AIReviewItem[] = [];
  let itemId = 1;

  for (const item of jsonItems) {
    const severityRaw = (item.severity || 'info').toLowerCase();
    const severity = ['critical', 'warning', 'info'].includes(severityRaw)
      ? (severityRaw as AIReviewItem['severity'])
      : 'info';

    // Support both snake_case and camelCase field names
    const filePath = item.file_path || item.filePath || '';
    const lineNumber = item.line_number || item.lineNumber || 1;
    const message = item.message || '';
    const suggestion = item.suggestion || undefined;

    // Parse categories from response
    const categories: AIReviewCategory[] = [];
    if (Array.isArray(item.categories) && item.categories.length > 0) {
      for (const c of item.categories) {
        if (typeof c === 'string' && isValidCategory(c)) {
          categories.push(c);
        }
      }
    }

    if (filePath && message) {
      items.push({
        id: `ai-review-${itemId++}`,
        severity,
        filePath,
        lineNumber,
        message,
        suggestion,
        categories,
      });
    }
  }

  return items;
}

const VALID_CATEGORIES = new Set<string>([
  'code-quality',
  'coding-convention',
  'security',
  'accessibility',
  'architecture',
  'api-design',
  'performance',
  'testing',
]);

function isValidCategory(value: string): value is AIReviewCategory {
  return VALID_CATEGORIES.has(value.toLowerCase());
}
