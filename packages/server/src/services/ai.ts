import type { AIReviewResult, AIReviewSuggestion } from '../types/index.js';
import { logger } from '../lib/logger.js';

// Default AI binary - can be overridden via environment variable
const AI_BINARY = process.env.CLAUDE_BINARY || process.env.AI_BINARY || 'claude';

// Cached binary check result (cache for 30 seconds)
let binaryCheckCache: { available: boolean; expiresAt: number } | null = null;
const BINARY_CHECK_TTL_MS = 30_000;

/**
 * Run AI CLI command safely using Bun.spawn with stdin (no shell injection)
 */
async function runAIWithStdin(prompt: string, opts?: { timeoutMs?: number }): Promise<string> {
  const proc = Bun.spawn([AI_BINARY, '-p', prompt], {
    stdin: null,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: opts?.timeoutMs ?? 120_000,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr || stdout || `${AI_BINARY} exited with code ${exitCode}`);
  }

  return stdout;
}

export async function checkAIBinary(): Promise<boolean> {
  // Return cached result if still valid
  if (binaryCheckCache && Date.now() < binaryCheckCache.expiresAt) {
    return binaryCheckCache.available;
  }

  try {
    const proc = Bun.spawn([AI_BINARY, '--version'], {
      stdin: null,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    binaryCheckCache = { available: true, expiresAt: Date.now() + BINARY_CHECK_TTL_MS };
    return true;
  } catch {
    binaryCheckCache = { available: false, expiresAt: Date.now() + BINARY_CHECK_TTL_MS };
    return false;
  }
}

export async function reviewDiff(
  diff: string,
  fileContext?: { filename: string; content: string }[]
): Promise<AIReviewResult> {
  const prompt = buildReviewPrompt(diff, fileContext);
  
  try {
    const stdout = await runAIWithStdin(prompt, { timeoutMs: 120_000 });
    return parseAIReviewOutput(stdout);
  } catch (error) {
    logger.error('AI review failed', error);
    return {
      suggestions: [],
      summary: 'AI review failed to complete.',
    };
  }
}

export async function reviewLine(
  filename: string,
  line: number,
  code: string,
  diff?: string
): Promise<string> {
  const prompt = `Please review this specific line of code and provide feedback:

File: ${filename}
Line: ${line}
Code: ${code}
${diff ? `\nDiff context:\n${diff}` : ''}

Provide a brief review comment about this line. Be concise and actionable.`;

  try {
    const stdout = await runAIWithStdin(prompt, { timeoutMs: 30_000 });
    return stdout.trim();
  } catch (error) {
    logger.error('Line review failed', error);
    return 'Unable to review this line at the moment.';
  }
}

function buildReviewPrompt(
  diff: string,
  fileContext?: { filename: string; content: string }[]
): string {
  let prompt = `You are a code reviewer. Please review the following code changes and provide suggestions.

Format your response as JSON with the following structure:
{
  "suggestions": [
    {
      "file": "filename",
      "line": line_number,
      "severity": "critical|warning|info",
      "comment": "your comment here",
      "code": "relevant code snippet (optional)"
    }
  ],
  "summary": "Brief summary of the review"
}

Diff to review:
${diff}
`;

  if (fileContext && fileContext.length > 0) {
    prompt += '\n\nAdditional file context:\n';
    for (const file of fileContext) {
      prompt += `\n--- ${file.filename} ---\n${file.content}\n`;
    }
  }

  prompt += `

Please identify:
1. Critical issues (bugs, security vulnerabilities, performance problems)
2. Warnings (code smells, potential improvements, best practice violations)
3. Info (suggestions, style improvements, documentation needs)

Focus on actionable feedback that improves code quality.`;

  return prompt;
}

function parseAIReviewOutput(output: string): AIReviewResult {
  try {
    // Try to find JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestions: parsed.suggestions || [],
        summary: parsed.summary || '',
      };
    }
    
    // Fallback: try to parse as plain text suggestions
    const suggestions: AIReviewSuggestion[] = [];
    const lines = output.split('\n');
    let currentSuggestion: Partial<AIReviewSuggestion> = {};
    
    for (const line of lines) {
      if (line.includes('File:')) {
        if (currentSuggestion.file) {
          suggestions.push(currentSuggestion as AIReviewSuggestion);
        }
        currentSuggestion = { file: line.split('File:')[1].trim() };
      } else if (line.includes('Line:')) {
        currentSuggestion.line = parseInt(line.split('Line:')[1].trim(), 10);
      } else if (line.includes('Severity:')) {
        const severity = line.split('Severity:')[1].trim().toLowerCase();
        currentSuggestion.severity = ['critical', 'warning', 'info'].includes(severity)
          ? (severity as AIReviewSuggestion['severity'])
          : 'info';
      } else if (line.includes('Comment:')) {
        currentSuggestion.comment = line.split('Comment:')[1].trim();
      }
    }
    
    if (currentSuggestion.file) {
      suggestions.push(currentSuggestion as AIReviewSuggestion);
    }
    
    return {
      suggestions,
      summary: output.slice(0, 200),
    };
  } catch (error) {
    logger.error('Failed to parse AI output', error);
    return {
      suggestions: [],
      summary: 'Failed to parse AI review results.',
    };
  }
}
