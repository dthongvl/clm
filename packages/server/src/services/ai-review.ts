import type { AIReviewItem, AIReviewPRResult, AIReviewCategory, AIReviewRunMode } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { opencodeClient } from './opencode-client.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { wrapError } from '../lib/errors.js';
import { buildReviewPrompt } from './ai-review-prompt.js';
import { mergeReviewItems } from './ai-review-merge.js';

const SEPARATE_MODE_CONCURRENCY = 2;

export interface GeneratePRReviewOptions {
  additionalContext?: string;
  reviewCategories: AIReviewCategory[];
  runMode: AIReviewRunMode;
}

/**
 * Generate AI code review for a PR using opencode server
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @param options - Review options including categories and run mode
 * @returns AIReviewPRResult containing the parsed review items
 */
export async function generatePRReview(prLink: string, options: GeneratePRReviewOptions): Promise<AIReviewPRResult> {
  const { additionalContext, reviewCategories, runMode } = options;

  try {
    if (runMode === 'separate') {
      return await runSeparateMode(prLink, reviewCategories, additionalContext);
    } else {
      return await runCombinedMode(prLink, reviewCategories, additionalContext);
    }
  } catch (error) {
    logger.error('AI review generation failed', error);
    throw wrapError(error, 'AI_ERROR', 'Failed to generate AI review', { prLink });
  }
}

/**
 * Combined mode: single prompt with all selected categories
 */
async function runCombinedMode(
  prLink: string,
  categories: AIReviewCategory[],
  additionalContext?: string,
): Promise<AIReviewPRResult> {
  const prompt = buildReviewPrompt({
    prLink,
    categories,
    additionalContext,
  });

  const model = await getModelForAction('ai-review');
  const variant = await getVariantForAction('ai-review');
  const response = await opencodeClient.prompt(prompt, { model, variant });
  
  return parseReviewOutput(response, categories);
}

/**
 * Separate mode: one prompt per category, then merge/dedupe results
 */
async function runSeparateMode(
  prLink: string,
  categories: AIReviewCategory[],
  additionalContext?: string,
): Promise<AIReviewPRResult> {
  const model = await getModelForAction('ai-review');
  const variant = await getVariantForAction('ai-review');

  interface CategoryResult {
    category: AIReviewCategory;
    items: AIReviewItem[];
    summary: string;
    error?: string;
  }

  const results = await mapWithConcurrency<AIReviewCategory, CategoryResult>(
    categories,
    SEPARATE_MODE_CONCURRENCY,
    async (category) => {
      try {
        const prompt = buildReviewPrompt({
          prLink,
          categories: [category],
          additionalContext,
          categoryScopeLabel: `${category}-only`,
        });

        const response = await opencodeClient.prompt(prompt, { model, variant });
        const parsed = parseReviewOutput(response, [category]);
        
        return {
          category,
          items: parsed.items,
          summary: parsed.summary,
        };
      } catch (error) {
        logger.warn(`Category ${category} review failed: ${(error as Error).message}`);
        return {
          category,
          items: [],
          summary: '',
          error: (error as Error).message,
        };
      }
    },
  );

  // Collect all items and merge/dedupe
  const allItems: AIReviewItem[] = [];
  const summaries: string[] = [];
  const failedCategories: string[] = [];

  for (const result of results) {
    if (result.error) {
      failedCategories.push(result.category);
    } else {
      allItems.push(...result.items);
      if (result.summary) {
        summaries.push(result.summary);
      }
    }
  }

  const mergedItems = mergeReviewItems(allItems);
  
  // Build combined summary
  let summary = summaries.length > 0
    ? summaries.join(' ')
    : 'No significant findings.';
  
  if (failedCategories.length > 0) {
    summary += ` (Note: ${failedCategories.join(', ')} review(s) failed)`;
  }

  return {
    items: mergedItems,
    summary,
  };
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

function parseReviewOutput(output: string, fallbackCategories: AIReviewCategory[]): AIReviewPRResult {
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
  const items = parseJsonReviewItems(parsed.items || [], fallbackCategories);

  return { items, summary };
}

function parseJsonReviewItems(
  jsonItems: JsonReviewItem[],
  fallbackCategories: AIReviewCategory[],
): AIReviewItem[] {
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
    
    // Parse categories from response, fallback to provided categories
    let categories: AIReviewCategory[];
    if (Array.isArray(item.categories) && item.categories.length > 0) {
      // Validate and filter to known categories
      const validCategories = item.categories
        .filter((c): c is AIReviewCategory => 
          typeof c === 'string' && isValidCategory(c)
        );
      categories = validCategories.length > 0 ? validCategories : fallbackCategories;
    } else {
      categories = fallbackCategories;
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
