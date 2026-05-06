import type { RelatedFilesResult, RelatedFile } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend } from './ai-backend/index.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { wrapError } from '../lib/errors.js';

/**
 * Find files related to the PR changes that might be relevant for code review
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @param additionalContext - Optional user-provided context to guide analysis
 * @returns RelatedFilesResult containing the list of related files
 */
export async function findRelatedFiles(prLink: string, additionalContext?: string): Promise<RelatedFilesResult> {
  const prompt = buildRelatedFilesPrompt(prLink, additionalContext);
  
  try {
    const model = await getModelForAction('related-files');
    const variant = await getVariantForAction('related-files');
    const response = await getAiBackend().prompt(prompt, { model, variant });
    return parseRelatedFilesOutput(response);
  } catch (error) {
    logger.error('Related files analysis failed', error);
    throw wrapError(error, 'AI_ERROR', 'Failed to find related files', { prLink });
  }
}

function buildRelatedFilesPrompt(prLink: string, additionalContext?: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  let prompt = `Analyze GitHub PR #${prNumber} in ${repo} and find files that are NOT in the PR but are important review context.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use gh for PR metadata (title/body/changed files).
- Use local git and code search to understand behavior and dependencies.

Step 1: Understand the PR.
- Read title/body and changed files.
- Infer what behavior, contracts, and data flow are being changed.

Step 2: Inspect changed code.
- Use local git commands to inspect the base-to-head diff.
- Identify touched APIs, types, modules, and side-effect boundaries.

Step 3: Find related non-PR files.
- Look for callers/callees, imports, shared types, configs, tests, docs, and downstream consumers.
- Prioritize files that help a reviewer validate impact and regression risk.
- Exclude files already changed in this PR.

Step 4: Return ONLY one minified JSON object (single line) with this exact schema:
{"files":[{"filePath":"path/to/related/file.ts","explanation":"Why this file is related, what dependency/flow connects it, and what reviewer should verify"}]}`;

  if (additionalContext) {
    prompt += `

User-provided additional context (optional guidance):
${additionalContext}

Use this context to prioritize analysis when relevant.
Do not violate required JSON schema and output constraints.`;
  }

  prompt += `

Output constraints:
- Return only the JSON object; no markdown, no code fences, no extra prose.
- Output must be valid minified JSON on a single line.
- Include only files not present in the PR changed-file list.
- Order by reviewer value (most important first).
- Limit to the 10 most relevant files.
- If no strong related files exist, return \`"files":[]\`.`;

  return prompt;
}

interface JsonRelatedFile {
  filePath?: string;
  explanation?: string;
}

interface JsonRelatedFilesResult {
  files?: JsonRelatedFile[];
}

function parseRelatedFilesOutput(output: string): RelatedFilesResult {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) {
    logger.warn('No JSON found in related files output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return { files: [] };
  }
  const parsed = parseJsonSafe<JsonRelatedFilesResult>(jsonContent);
  if (!parsed?.files || !Array.isArray(parsed.files)) {
    logger.warn('Invalid JSON structure in related files response');
    return { files: [] };
  }

  const files: RelatedFile[] = parsed.files
    .filter((file): file is JsonRelatedFile =>
      !!file && typeof file.filePath === 'string' && typeof file.explanation === 'string'
    )
    .map(file => ({
      filePath: file.filePath!,
      explanation: file.explanation!.trim(),
    }));

  return { files };
}
