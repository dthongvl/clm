import type { AIReviewItem, AIReviewPRResult, AIReviewCategory } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend } from './ai-backend/index.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { wrapError } from '../lib/errors.js';
import { buildReviewPrompt } from './ai-review-prompt.js';

export interface GeneratePRReviewOptions {
  additionalContext?: string;
}

/**
 * Generate AI code review for a PR using opencode server
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @param options - Review options
 * @returns AIReviewPRResult containing the parsed review items
 */
export async function generatePRReview(prLink: string, options: GeneratePRReviewOptions = {}): Promise<AIReviewPRResult> {
  const { additionalContext } = options;

  try {
    const prompt = buildReviewPrompt({ prLink, additionalContext });

    const model = await getModelForAction('ai-review');
    const variant = await getVariantForAction('ai-review');
    const response = await getAiBackend().prompt(prompt, { model, variant });

    return parseReviewOutput(response);
  } catch (error) {
    logger.error('AI review generation failed', error);
    throw wrapError(error, 'AI_ERROR', 'Failed to generate AI review', { prLink });
  }
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
