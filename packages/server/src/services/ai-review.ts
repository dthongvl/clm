import type { AIReviewItem, AIReviewPRResult } from '../types/index.js';
import { extractYamlBlock, parseYamlSafe } from '../utils/yaml-extract.js';
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

  return `You are a code reviewer. Analyze GitHub PR #${prNumber} in ${repo} and provide detailed code review feedback.

Step 1: Get PR information and branch names:
gh pr view ${prNumber} --repo ${repo} --json title,body,baseRefName,headRefName

Step 2: Fetch the latest branches and get the diff locally (faster than gh pr diff):
git fetch origin <baseRefName> <headRefName>
git diff origin/<baseRefName>...origin/<headRefName>

Step 3: Read and analyze the diff carefully. Look for:
- Critical issues: bugs, security vulnerabilities, performance problems, data loss risks
- Warnings: code smells, potential improvements, best practice violations, error handling issues
- Info: suggestions, style improvements, documentation needs, minor optimizations

Step 4: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
summary: Brief overall summary of the PR and key findings
items:
  - severity: critical  # must be: critical, warning, or info
    file_path: path/to/file.ts
    line_number: 42
    message: Clear description of the issue or suggestion
    suggestion: Optional suggested code fix or improvement
\`\`\`

Rules:
- severity must be one of: critical, warning, info
- line_number must reference the actual line in the changed file (use the new line numbers from the diff)
- message should be actionable and explain why this is important
- suggestion is optional but helpful when applicable
- Focus on meaningful issues, not trivial style preferences
- Include context about why something is problematic
- Return ONLY the YAML code block, nothing else`;
}

interface YamlReviewItem {
  severity?: string;
  file_path?: string;
  filePath?: string;
  line_number?: number;
  lineNumber?: number;
  message?: string;
  suggestion?: string;
}

interface YamlReviewResult {
  summary?: string;
  items?: YamlReviewItem[];
}

function parseReviewOutput(output: string): AIReviewPRResult {
  const yamlContent = extractYamlBlock(output, ['summary', 'items']);
  if (!yamlContent) {
    logger.warn('No YAML review found in AI output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return { items: [], summary: '' };
  }
  const parsed = parseYamlSafe<YamlReviewResult>(yamlContent);
  if (!parsed) {
    logger.error('Failed to parse review YAML', new Error('YAML parse failed'));
    return { items: [], summary: '' };
  }

  const summary = parsed.summary || '';
  const items = parseYamlReviewItems(parsed.items || []);

  return { items, summary };
}

function parseYamlReviewItems(yamlItems: YamlReviewItem[]): AIReviewItem[] {
  if (!Array.isArray(yamlItems)) {
    return [];
  }
  
  const items: AIReviewItem[] = [];
  let itemId = 1;
  
  for (const item of yamlItems) {
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

