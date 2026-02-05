import { parse as parseYaml } from 'yaml';
import type { ChangeGroup, GroupingResult } from '../types/index.js';
import { opencodeClient } from './opencode-client.js';
import { logger } from '../lib/logger.js';

// Model to use for grouping - can be overridden via environment variable
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-3-flash-preview';

/**
 * Generate intelligent grouping for a PR using opencode server
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @returns GroupingResult containing the parsed groups
 */
export async function generateGrouping(prLink: string): Promise<GroupingResult> {
  const prompt = buildGroupingPrompt(prLink);
  
  try {
    const response = await opencodeClient.prompt(prompt, { model: AI_MODEL });
    return parseGroupingOutput(response);
  } catch (error) {
    logger.error('Grouping generation failed', error);
    throw new Error(`Failed to generate grouping: ${(error as Error).message}`);
  }
}

function buildGroupingPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and group files for code review.

Step 1: Get PR information and branch names:
gh pr view ${prNumber} --repo ${repo} --json title,body,baseRefName,headRefName,files

Step 2: Fetch the latest branches and get the diff locally (faster than gh pr diff):
git fetch origin <baseRefName> <headRefName>
git diff origin/<baseRefName>...origin/<headRefName>

Step 3: Read the PR description to understand the intent and context of the changes. Then analyze the diff and group logically connected changes. Order groups so reviewers can understand the PR from top to bottom.

Step 4: For each group, assess the risk level:
- HIGH: Core business logic, payment/billing, authentication, security, database migrations, data processing pipelines
- MEDIUM: API endpoints, shared utilities, configuration, non-critical features
- LOW: Tests, documentation, comments, formatting, dev tooling, experimental features

Step 5: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
groups:
  - id: group-1
    title: Short descriptive title
    riskLevel: high  # must be: high, medium, or low
    riskReason: Brief reason why this risk level was assigned
    explanation: |
      Quick explanation of this group:
      - Why these files are grouped together
      - What functionality or feature they implement/modify
      - Key changes in each file and how they relate
      - Any important context for reviewers (dependencies, side effects, etc.)
    files:
      - path: path/to/file.ts
        additions: 10
        deletions: 5
\`\`\`

Rules:
- Files can appear in multiple groups if they serve multiple purposes
- Order groups by risk level (high-risk first, then medium, then low)
- Provide detailed explanations that help reviewers understand the changes without reading all the code
- Use actual additions/deletions from the gh output for each file
- Return ONLY the YAML code block, nothing else`;
}

interface YamlFileEntry {
  path: string;
  additions?: number;
  deletions?: number;
}

interface YamlGroup {
  id?: string;
  title?: string;
  explanation?: string;
  riskLevel?: string;
  riskReason?: string;
  files?: (YamlFileEntry | string)[];
}

interface YamlGroupingResult {
  groups?: YamlGroup[];
}

function parseGroupingOutput(output: string): GroupingResult {
  try {
    // Extract YAML from code block or raw YAML
    const yamlMatch = output.match(/```ya?ml\n([\s\S]*?)```/) 
      || output.match(/^(groups:\n[\s\S]*)/m);
    
    if (!yamlMatch) {
      logger.warn('No YAML grouping found in AI output');
      logger.debug(`Output preview: ${output.slice(0, 200)}...`);
      return { groups: [] };
    }
    
    const yamlContent = yamlMatch[1];
    const parsed = parseYaml(yamlContent) as YamlGroupingResult;
    
    if (!parsed?.groups || !Array.isArray(parsed.groups)) {
      logger.warn('Invalid YAML structure in grouping response');
      return { groups: [] };
    }
    
    const groups = parseYamlGroups(parsed.groups);
    return { groups };
  } catch (error) {
    logger.error('Failed to parse grouping output', error);
    logger.debug(`Raw output: ${output.slice(0, 500)}...`);
    return { groups: [] };
  }
}

function parseYamlGroups(yamlGroups: YamlGroup[]): ChangeGroup[] {
  return yamlGroups.map((group, index) => {
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

/**
 * Build a PR link from repo and PR number
 */
export function buildPRLink(repo: string, prNumber: number): string {
  if (repo.startsWith('http')) {
    return `${repo}/pull/${prNumber}`;
  }
  return `https://github.com/${repo}/pull/${prNumber}`;
}
