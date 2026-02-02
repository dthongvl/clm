import type { AIReviewItem, AIReviewPRResult } from '../types/index.js';
import { opencodeManager } from './opencode-manager.js';

// Model to use for review - can be overridden via environment variable
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-3-flash-preview';

export async function checkAIReviewBinary(): Promise<boolean> {
  try {
    await opencodeManager.start();
    return opencodeManager.isReady();
  } catch {
    return false;
  }
}

/**
 * Generate AI code review for a PR using opencode server
 * @param prLink - The GitHub PR link (e.g., https://github.com/owner/repo/pull/123)
 * @returns AIReviewPRResult containing the parsed review items
 */
export async function generatePRReview(prLink: string): Promise<AIReviewPRResult> {
  const prompt = buildReviewPrompt(prLink);
  
  try {
    const response = await opencodeManager.prompt(prompt, { model: AI_MODEL });
    return parseReviewOutput(response);
  } catch (error) {
    console.error('AI review generation failed:', error);
    throw new Error(`Failed to generate AI review: ${(error as Error).message}`);
  }
}

function buildReviewPrompt(prLink: string): string {
  // Extract PR number and repo from the link
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `You are a code reviewer. Analyze GitHub PR #${prNumber} in ${repo} and provide detailed code review feedback.

Step 1: Use the \`gh\` CLI tool to fetch the PR diff:
gh pr diff ${prNumber} --repo ${repo}

Step 2: Read and analyze the diff carefully. Look for:
- Critical issues: bugs, security vulnerabilities, performance problems, data loss risks
- Warnings: code smells, potential improvements, best practice violations, error handling issues
- Info: suggestions, style improvements, documentation needs, minor optimizations

Step 3: Return ONLY this XML format (no other text):

<review>
<summary>Brief overall summary of the PR and key findings</summary>
<items>
<item>
<severity>critical|warning|info</severity>
<filePath>path/to/file.ts</filePath>
<lineNumber>42</lineNumber>
<message>Clear description of the issue or suggestion</message>
<suggestion>Optional: suggested code fix or improvement</suggestion>
</item>
</items>
</review>

Rules:
- severity must be one of: critical, warning, info
- lineNumber must reference the actual line in the changed file (use the new line numbers from the diff)
- message should be actionable and explain why this is important
- suggestion is optional but helpful when applicable
- Focus on meaningful issues, not trivial style preferences
- Include context about why something is problematic
- Return ONLY the XML, nothing else`;
}

function parseReviewOutput(output: string): AIReviewPRResult {
  try {
    // Find XML content in the output
    const xmlMatch = output.match(/<review>[\s\S]*<\/review>/);
    
    if (!xmlMatch) {
      console.error('No XML review found in output:', output.slice(0, 500));
      return { items: [], summary: '' };
    }
    
    const xmlContent = xmlMatch[0];
    const { items, summary } = parseXMLReview(xmlContent);
    
    return { items, summary };
  } catch (error) {
    console.error('Failed to parse review output:', error);
    console.error('Raw output:', output.slice(0, 1000));
    return { items: [], summary: '' };
  }
}

function parseXMLReview(xml: string): { items: AIReviewItem[]; summary: string } {
  const items: AIReviewItem[] = [];
  
  // Extract summary
  const summaryMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/);
  const summary = summaryMatch ? summaryMatch[1].trim() : '';
  
  // Match each item element
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  
  let itemId = 1;
  for (const match of itemMatches) {
    const itemContent = match[1];
    
    // Extract severity
    const severityMatch = itemContent.match(/<severity>(.*?)<\/severity>/);
    const severityRaw = severityMatch ? severityMatch[1].trim().toLowerCase() : 'info';
    const severity = ['critical', 'warning', 'info'].includes(severityRaw)
      ? (severityRaw as AIReviewItem['severity'])
      : 'info';
    
    // Extract filePath
    const filePathMatch = itemContent.match(/<filePath>(.*?)<\/filePath>/);
    const filePath = filePathMatch ? filePathMatch[1].trim() : '';
    
    // Extract lineNumber
    const lineNumberMatch = itemContent.match(/<lineNumber>(.*?)<\/lineNumber>/);
    const lineNumber = lineNumberMatch ? parseInt(lineNumberMatch[1].trim(), 10) : 0;
    
    // Extract message
    const messageMatch = itemContent.match(/<message>([\s\S]*?)<\/message>/);
    const message = messageMatch ? messageMatch[1].trim() : '';
    
    // Extract suggestion (optional)
    const suggestionMatch = itemContent.match(/<suggestion>([\s\S]*?)<\/suggestion>/);
    const suggestion = suggestionMatch ? suggestionMatch[1].trim() : undefined;
    
    // Only add if we have the required fields
    if (filePath && message) {
      items.push({
        id: `ai-review-${itemId++}`,
        severity,
        filePath,
        lineNumber: lineNumber || 1,
        message,
        suggestion,
      });
    }
  }
  
  return { items, summary };
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
