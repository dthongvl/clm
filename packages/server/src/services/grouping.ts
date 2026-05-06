import type { ChangeGroup, GroupingResult } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend } from './ai-backend/index.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { wrapError } from '../lib/errors.js';

/**
 * Generate intelligent grouping for a PR using opencode server
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @param additionalContext - Optional user-provided context to guide analysis
 * @returns GroupingResult containing the parsed groups
 */
export async function generateGrouping(prLink: string, additionalContext?: string): Promise<GroupingResult> {
  const prompt = buildGroupingPrompt(prLink, additionalContext);
  
  try {
    const model = await getModelForAction('grouping');
    const variant = await getVariantForAction('grouping');
    const response = await getAiBackend().prompt(prompt, { model, variant });
    return parseGroupingOutput(response);
  } catch (error) {
    logger.error('Grouping generation failed', error);
    throw wrapError(error, 'AI_ERROR', 'Failed to generate grouping', { prLink });
  }
}

function buildGroupingPrompt(prLink: string, additionalContext?: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  let prompt = `Analyze GitHub PR #${prNumber} in ${repo} and create reviewer-friendly change groups.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use gh for PR metadata and changed-file stats.
- Use local git to inspect full diffs between base and head.

Step 1: Gather PR context.
- Read title/body, base/head refs, and changed files with additions/deletions.
- Understand intent and review surface.

Step 2: Analyze the patch.
- Inspect local git diff between base and head.
- Identify logically connected changes and dependency chains.
- Order groups so reviewers can follow the PR from highest risk to lowest.

Step 3: Assign a risk level to each group.
- HIGH: core business logic, auth/security, billing/payments, migrations, data pipelines
- MEDIUM: API behavior, shared utilities, configuration, non-critical features
- LOW: tests, docs, comments, formatting, tooling-only changes

Step 4: Return ONLY one minified JSON object (single line) with this exact schema:
{"groups":[{"id":"group-1","title":"Short descriptive title","riskLevel":"high","riskReason":"Brief reason for this risk level","explanation":"Quick explanation of this group: why files belong together, what behavior changed, and key reviewer focus points","files":[{"path":"path/to/file.ts","additions":10,"deletions":5}]}]}`;

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
- Use actual additions/deletions from PR metadata for each file.
- A file may appear in multiple groups if it serves multiple concerns.
- Prioritize clarity and review order over perfect taxonomy.
- If the PR is tiny/simple, return a single group.`;

  return prompt;
}

interface JsonFileEntry {
  path: string;
  additions?: number;
  deletions?: number;
}

interface JsonGroup {
  id?: string;
  title?: string;
  explanation?: string;
  riskLevel?: string;
  riskReason?: string;
  files?: (JsonFileEntry | string)[];
}

interface JsonGroupingResult {
  groups?: JsonGroup[];
}

function parseGroupingOutput(output: string): GroupingResult {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) {
    logger.warn('No JSON grouping found in AI output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return { groups: [] };
  }
  const parsed = parseJsonSafe<JsonGroupingResult>(jsonContent);
  if (!parsed?.groups || !Array.isArray(parsed.groups)) {
    logger.warn('Invalid JSON structure in grouping response');
    return { groups: [] };
  }

  const groups = parseJsonGroups(parsed.groups);
  return { groups };
}

function parseJsonGroups(jsonGroups: JsonGroup[]): ChangeGroup[] {
  return jsonGroups.map((group, index) => {
    const files: string[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    if (Array.isArray(group.files)) {
      for (const file of group.files) {
        if (typeof file === 'string') {
          files.push(file);
        } else if (file && typeof file === 'object') {
          files.push(file.path);
          totalAdditions += file.additions || 0;
          totalDeletions += file.deletions || 0;
        }
      }
    }

    const riskLevelRaw = (group.riskLevel || 'medium').toLowerCase();
    const riskLevel = ['high', 'medium', 'low'].includes(riskLevelRaw)
      ? (riskLevelRaw as 'high' | 'medium' | 'low')
      : 'medium';
    
    return {
      id: group.id || `group-${index + 1}`,
      title: group.title || 'Unnamed Group',
      summary: group.explanation || '',
      files,
      totalAdditions,
      totalDeletions,
      riskLevel,
      riskReason: group.riskReason || undefined,
    };
  });
}
