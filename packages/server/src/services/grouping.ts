import type { ChangeGroup, GroupingResult } from '../types/index.js';

// Default AI binary - can be overridden via environment variable
const AI_BINARY = process.env.AI_BINARY || 'opencode';

// Model to use for grouping - can be overridden via environment variable
// const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-haiku-4-5-20251001';
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-3-flash-preview';

export async function checkOpencodeBinary(): Promise<boolean> {
  try {
    const proc = Bun.spawn([AI_BINARY, '--version'], {
      stdin: null,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate intelligent grouping for a PR using opencode CLI
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @returns GroupingResult containing the parsed groups
 */
export async function generateGrouping(prLink: string): Promise<GroupingResult> {
  const prompt = buildGroupingPrompt(prLink);
  
  try {
    // Execute opencode CLI with the 'run' command for non-interactive mode
    // Use -m flag to specify the model
    // Pass the prompt directly as the message argument
    const stdout = await runOpencode([
      'run',
      '-m', AI_MODEL,
      prompt
    ]);
    
    return parseGroupingOutput(stdout);
  } catch (error) {
    console.error('Grouping generation failed:', error);
    throw new Error(`Failed to generate grouping: ${(error as Error).message}`);
  }
}

/**
 * Run opencode CLI command using Bun.spawn for better handling of arguments
 */
async function runOpencode(args: string[]): Promise<string> {
  const proc = Bun.spawn([AI_BINARY, ...args], {
    stdin: null,      // ignore stdin to prevent blocking
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 300000,  // 5 minutes
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (stderr) {
    console.warn('opencode stderr:', stderr);
  }

  if (exitCode !== 0) {
    throw new Error(`opencode exited with code ${exitCode}: ${stderr || stdout}`);
  }

  return stdout;
}

function buildGroupingPrompt(prLink: string): string {
  // Extract PR number and repo from the link
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and group files for code review.

Step 1: Use the \`gh\` CLI tool to fetch the PR information:
gh pr view ${prNumber} --repo ${repo} --json title,body,files

Step 2: Read the PR description to understand the intent and context of the changes. Then analyze the diff and group logically connected changes. Order groups so reviewers can understand the PR from top to bottom.

Step 3: Return ONLY this XML format (no other text):

<grouping>
<group>
<id>group-1</id>
<title>Short descriptive title</title>
<explanation>
Quick explanation of this group:
- Why these files are grouped together
- What functionality or feature they implement/modify
- Key changes in each file and how they relate
- Any important context for reviewers (dependencies, side effects, etc.)
</explanation>
<files>
<file path="path/to/file.ts" additions="10" deletions="5"/>
</files>
</group>
</grouping>

Rules:
- Files can appear in multiple groups if they serve multiple purposes
- Order groups logically (e.g., core changes first, then dependent changes, tests last)
- Provide detailed explanations that help reviewers understand the changes without reading all the code
- Use actual additions/deletions from the gh output for each file
- Return ONLY the XML, nothing else`;
}

function parseGroupingOutput(output: string): GroupingResult {
  try {
    // Find XML content in the output
    const xmlMatch = output.match(/<grouping>[\s\S]*<\/grouping>/);
    
    if (!xmlMatch) {
      console.error('No XML grouping found in output:', output.slice(0, 500));
      return { groups: [] };
    }
    
    const xmlContent = xmlMatch[0];
    const groups = parseXMLGroups(xmlContent);
    
    return { groups };
  } catch (error) {
    console.error('Failed to parse grouping output:', error);
    console.error('Raw output:', output.slice(0, 1000));
    return { groups: [] };
  }
}

function parseXMLGroups(xml: string): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  
  // Match each group element
  const groupMatches = xml.matchAll(/<group>([\s\S]*?)<\/group>/g);
  
  for (const match of groupMatches) {
    const groupContent = match[1];
    
    // Extract id
    const idMatch = groupContent.match(/<id>(.*?)<\/id>/);
    const id = idMatch ? idMatch[1].trim() : `group-${groups.length + 1}`;
    
    // Extract title
    const titleMatch = groupContent.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unnamed Group';
    
    // Extract explanation
    const explanationMatch = groupContent.match(/<explanation>([\s\S]*?)<\/explanation>/);
    const summary = explanationMatch ? explanationMatch[1].trim() : '';
    
    // Extract files and calculate totals
    const files: string[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    // Match <file path="..." additions="..." deletions="..."/>
    const fileWithStatsMatches = groupContent.matchAll(/<file\s+path="([^"]+)"\s+additions="(\d+)"\s+deletions="(\d+)"(?:\s*\/>|>.*?<\/file>)/g);
    for (const fileMatch of fileWithStatsMatches) {
      files.push(fileMatch[1]);
      totalAdditions += parseInt(fileMatch[2], 10);
      totalDeletions += parseInt(fileMatch[3], 10);
    }
    
    // Also handle <file path="..."/> without stats
    if (files.length === 0) {
      const pathOnlyMatches = groupContent.matchAll(/<file\s+path="([^"]+)"(?:\s*\/>|>.*?<\/file>)/g);
      for (const fileMatch of pathOnlyMatches) {
        files.push(fileMatch[1]);
      }
    }
    
    // Also handle <file>path</file> format
    if (files.length === 0) {
      const simpleFileMatches = groupContent.matchAll(/<file>(.*?)<\/file>/g);
      for (const fileMatch of simpleFileMatches) {
        files.push(fileMatch[1].trim());
      }
    }
    
    groups.push({
      id,
      title,
      summary,
      files,
      totalAdditions,
      totalDeletions,
    });
  }
  
  return groups;
}

/**
 * Build a PR link from repo and PR number
 */
export function buildPRLink(repo: string, prNumber: number): string {
  // Handle both "owner/repo" and full URL formats
  if (repo.startsWith('http')) {
    return `${repo}/pull/${prNumber}`;
  }
  return `https://github.com/${repo}/pull/${prNumber}`;
}
