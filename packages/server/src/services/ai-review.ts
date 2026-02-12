import type { AIReviewItem, AIReviewPRResult } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { opencodeClient } from './opencode-client.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { wrapError } from '../lib/errors.js';

/**
 * Generate AI code review for a PR using opencode server
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @returns AIReviewPRResult containing the parsed review items
 */
export async function generatePRReview(prLink: string): Promise<AIReviewPRResult> {
  const prompt = buildReviewPrompt(prLink);
  
  try {
    const model = await getModelForAction('ai-review');
    const variant = await getVariantForAction('ai-review');
    const response = await opencodeClient.prompt(prompt, { model, variant });
    return parseReviewOutput(response);
  } catch (error) {
    logger.error('AI review generation failed', error);
    // Wrap with context, preserving the original error as cause
    throw wrapError(error, 'AI_ERROR', 'Failed to generate AI review', { prLink });
  }
}

function buildReviewPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `You are a senior code reviewer. Analyze GitHub PR #${prNumber} in ${repo} and produce high-signal review findings.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use local git for diff analysis and gh for PR metadata.

Step 1: Gather PR context.
- Read PR title/body, base/head refs, and changed-file scope.
- Understand the intent before judging implementation.

Step 2: Inspect code changes.
- Use local git commands to compare base and head branches and inspect the patch.
- Use new-file line numbers from the diff when reporting findings.
- Read nearby code when needed to avoid false positives.

Step 3: Identify meaningful findings.
- critical: bugs, security issues, data loss, race conditions, major performance regressions
- warning: correctness risks, edge cases, missing error handling, maintainability issues
- info: useful improvements with practical impact
- Avoid trivial style nitpicks unless they hide real risk.
- Prefer fewer high-confidence findings over many weak guesses.

Step 4: Return ONLY one minified JSON object (single line) with this exact schema:
{"summary":"Brief overall summary of the PR and key findings","items":[{"severity":"critical","filePath":"path/to/file.ts","lineNumber":42,"message":"Clear description of the issue and why it matters","suggestion":"Optional concrete fix"}]}

Output constraints:
- Return only the JSON object; no markdown, no code fences, no extra prose.
- Output must be valid minified JSON on a single line.
- severity must be exactly: critical, warning, or info.
- lineNumber must map to the changed file's new-line numbering.
- message must be actionable and include impact.
- If there are no meaningful findings, return \`"items":[]\` with a concise summary.`;
}

interface JsonReviewItem {
  severity?: string;
  file_path?: string;
  filePath?: string;
  line_number?: number;
  lineNumber?: number;
  message?: string;
  suggestion?: string;
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
    
    if (filePath && message) {
      items.push({
        id: `ai-review-${itemId++}`,
        severity,
        filePath,
        lineNumber,
        message,
        suggestion,
      });
    }
  }
  
  return items;
}
