import type { RelatedFilesResult, RelatedFile } from '../types/index.js';
import { extractYamlBlock, parseYamlSafe } from '../utils/yaml-extract.js';
import { opencodeClient } from './opencode-client.js';
import { getModelForAction, getVariantForAction } from './settings.js';
import { logger } from '../lib/logger.js';

/**
 * Find files related to the PR changes that might be relevant for code review
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @returns RelatedFilesResult containing the list of related files
 */
export async function findRelatedFiles(prLink: string): Promise<RelatedFilesResult> {
  const prompt = buildRelatedFilesPrompt(prLink);
  
  try {
    const model = await getModelForAction('related-files');
    const variant = await getVariantForAction('related-files');
    const response = await opencodeClient.prompt(prompt, { model, variant });
    return parseRelatedFilesOutput(response);
  } catch (error) {
    logger.error('Related files analysis failed', error);
    throw new Error(`Failed to find related files: ${(error as Error).message}`);
  }
}

function buildRelatedFilesPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and find related files that are NOT part of this PR but might be relevant for reviewers.

Step 1: Get PR information and branch names:
gh pr view ${prNumber} --repo ${repo} --json title,body,baseRefName,headRefName,files

Step 2: Fetch the latest branches and get the diff locally (faster than gh pr diff):
git fetch origin <baseRefName> <headRefName>
git diff origin/<baseRefName>...origin/<headRefName>

Step 3: Read the PR description and analyze the changed files to understand:
- What features or functionality is being modified
- What APIs, interfaces, or contracts are being changed
- What dependencies exist between the changed files and other parts of the codebase

Step 4: Search the codebase to find files that:
- Import from or are imported by the changed files
- Use the same APIs, functions, or components being modified
- Could be affected by the changes (downstream dependencies)
- Provide context about how the changed code is used
- Contain related tests or documentation
- Define types/interfaces used by the changed files

Step 5: For each related file found, explain the code flow and why it's relevant.

Step 6: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
files:
  - filePath: path/to/related/file.ts
    explanation: |
      Brief explanation of why this file is related:
      - How it connects to the changed files
      - What code flow or dependency exists
      - What the reviewer should look for
\`\`\`

Rules:
- Only include files that are NOT in the PR's changed files list
- Prioritize files that are most likely to be affected by the changes
- Focus on files that help reviewers understand the impact and context
- Order files by relevance (most important first)
- Limit to 10 most relevant files
- Return ONLY the YAML code block, nothing else`;
}

interface YamlRelatedFile {
  filePath?: string;
  explanation?: string;
}

interface YamlRelatedFilesResult {
  files?: YamlRelatedFile[];
}

function parseRelatedFilesOutput(output: string): RelatedFilesResult {
  const yamlContent = extractYamlBlock(output, ['files']);
  if (!yamlContent) {
    logger.warn('No YAML found in related files output');
    logger.debug(`Output preview: ${output.slice(0, 200)}...`);
    return { files: [] };
  }
  const parsed = parseYamlSafe<YamlRelatedFilesResult>(yamlContent);
  if (!parsed?.files || !Array.isArray(parsed.files)) {
    logger.warn('Invalid YAML structure in related files response');
    return { files: [] };
  }

  const files: RelatedFile[] = parsed.files
    .filter((file): file is YamlRelatedFile =>
      !!file && typeof file.filePath === 'string' && typeof file.explanation === 'string'
    )
    .map(file => ({
      filePath: file.filePath!,
      explanation: file.explanation!.trim(),
    }));

  return { files };
}
