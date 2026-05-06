import type { PatternVerification, PatternVerificationResult, PatternLocation } from '../types/index.js';
import { extractJsonBlock, parseJsonSafe } from '../utils/json-extract.js';
import { getAiBackend } from './ai-backend/index.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';
import { wrapError } from '../lib/errors.js';

/**
 * Verify that cross-file updates in a PR are complete and consistent
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @param additionalContext - Optional user-provided context to guide analysis
 * @returns PatternVerificationResult containing the verification findings
 */
export async function verifyPatterns(prLink: string, additionalContext?: string): Promise<PatternVerificationResult> {
  const prompt = buildVerificationPrompt(prLink, additionalContext);
  
  try {
    const model = await getModelForAction('pattern-verification');
    const variant = await getVariantForAction('pattern-verification');
    const response = await getAiBackend().prompt(prompt, { model, variant });
    return parseVerificationOutput(response);
  } catch (error) {
    logger.error('Pattern verification failed', error);
    throw wrapError(error, 'AI_ERROR', 'Failed to verify patterns', { prLink });
  }
}

function buildVerificationPrompt(prLink: string, additionalContext?: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  let prompt = `Analyze GitHub PR #${prNumber} in ${repo} and verify that cross-file updates are complete and consistent.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use gh to get PR metadata and base/head refs.
- Use local git diff and code search to verify all affected locations.

Step 1: Gather context and patch.
- Read PR title/body and changed files.
- Inspect local diff between base and head branches.

Step 2: Detect patterns that require consistency checks.
- Renamed symbols (functions, methods, classes, files)
- Signature or type-contract changes
- API route/request/response changes
- Constant, config, or schema changes with broad references

Step 3: Verify completeness.
- Search the codebase for related occurrences.
- Confirm each relevant location is updated or intentionally unchanged.
- Flag likely misses or suspicious leftovers.

Step 4: Return ONLY one minified JSON object (single line) with this exact schema:
{"summary":"Brief summary of verification findings","verifications":[{"id":"verify-1","pattern":"functionName renamed to newFunctionName","description":"What changed and what should be checked","status":"verified","details":"Found 8 call sites; all 8 are updated","locations":[{"filePath":"path/to/file.ts","lineNumber":42,"status":"updated","snippet":"newFunctionName(args)"}]}]}`;

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
- Include only patterns that actually need cross-file verification.
- Use \`incomplete\` when updates are likely missing.
- Use \`warning\` when uncertain and human review is needed.
- If no verification patterns are found, return \`"verifications":[]\` with a short summary.`;

  return prompt;
}

interface JsonPatternLocation {
  filePath?: string;
  lineNumber?: number;
  status?: string;
  snippet?: string;
}

interface JsonPatternVerification {
  id?: string;
  pattern?: string;
  description?: string;
  status?: string;
  details?: string;
  locations?: JsonPatternLocation[];
}

interface JsonVerificationResult {
  summary?: string;
  verifications?: JsonPatternVerification[];
}

function parseVerificationOutput(output: string): PatternVerificationResult {
  const jsonContent = extractJsonBlock(output);
  if (!jsonContent) {
    logger.warn('No JSON found in verification output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return { verifications: [], summary: '' };
  }
  const parsed = parseJsonSafe<JsonVerificationResult>(jsonContent);
  if (!parsed) {
    logger.error('Failed to parse verification JSON', new Error('JSON parse failed'));
    return { verifications: [], summary: '' };
  }

  const summary = parsed.summary || '';
  const verifications = parseJsonVerifications(parsed.verifications || []);

  return { verifications, summary };
}

function parseJsonVerifications(jsonVerifications: JsonPatternVerification[]): PatternVerification[] {
  if (!Array.isArray(jsonVerifications)) {
    return [];
  }
  
  return jsonVerifications
    .filter((v): v is JsonPatternVerification => !!v && typeof v.pattern === 'string')
    .map((v, index) => {
      const statusRaw = (v.status || 'warning').toLowerCase();
      const status = ['verified', 'incomplete', 'warning'].includes(statusRaw)
        ? (statusRaw as PatternVerification['status'])
        : 'warning';

      const locations: PatternLocation[] = (v.locations || [])
        .filter((loc): loc is JsonPatternLocation => !!loc && typeof loc.filePath === 'string')
        .map(loc => {
          const locStatusRaw = (loc.status || 'suspicious').toLowerCase();
          const locStatus = ['updated', 'missing', 'suspicious'].includes(locStatusRaw)
            ? (locStatusRaw as PatternLocation['status'])
            : 'suspicious';

          return {
            filePath: loc.filePath!,
            lineNumber: loc.lineNumber || 1,
            status: locStatus,
            snippet: loc.snippet,
          };
        });

      return {
        id: v.id || `verify-${index + 1}`,
        pattern: v.pattern!,
        description: v.description || '',
        status,
        details: v.details || '',
        locations,
      };
    });
}
