import type { PRInfo, PRComment } from '../types/index.js';
import { logger } from '../lib/logger.js';

/**
 * Run gh CLI command safely using Bun.spawn (no shell injection)
 */
async function runGh(args: string[], opts?: { timeoutMs?: number }): Promise<string> {
  const proc = Bun.spawn(['gh', ...args], {
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
    throw new Error(stderr || stdout || `gh exited with code ${exitCode}`);
  }

  return stdout;
}

function parsePaginatedArray<T>(stdout: string): T[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  const parseArray = (value: string): T[] => {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      throw new Error('Expected GitHub API response to be an array');
    }

    // gh api --paginate --slurp returns an array of pages.
    // Flatten those pages while still supporting plain array responses.
    if (parsed.length > 0 && parsed.every(Array.isArray)) {
      return (parsed as T[][]).flat();
    }

    return parsed as T[];
  };

  try {
    return parseArray(trimmed);
  } catch (error) {
    // Fallback for concatenated JSON pages (older gh behavior without --slurp).
    // gh api emits one JSON document per line in this mode.
    const pages = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (pages.length > 1) {
      try {
        const merged = `[${pages.join(',')}]`;
        return parseArray(merged);
      } catch {
        // Re-throw the original parsing error below for clearer context.
      }
    }

    throw error;
  }
}

function shouldRetryCommentParse(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('JSON Parse error')
    || error.message.includes('Unexpected EOF')
    || error.message.includes('Unterminated string');
}

async function getPaginatedComments(endpoint: string): Promise<PRComment[]> {
  const args = ['api', endpoint, '--paginate', '--slurp'];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const stdout = await runGh(args);
      return parsePaginatedArray<PRComment>(stdout);
    } catch (error) {
      const canRetry = attempt < maxAttempts && shouldRetryCommentParse(error);
      if (!canRetry) {
        throw error;
      }

      logger.warn(`Malformed comment payload from GitHub API, retrying (${attempt}/${maxAttempts})`);
    }
  }

  return [];
}

export async function checkGhCli(): Promise<boolean> {
  try {
    await runGh(['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function getPRInfo(prNumber: number, repo?: string): Promise<PRInfo> {
  const args = ['pr', 'view', String(prNumber), '--json', 'number,title,author,body,baseRefName,headRefName'];
  if (repo) {
    args.push('--repo', repo);
  }
  
  const stdout = await runGh(args);
  const data = JSON.parse(stdout);
  
  return {
    number: data.number,
    title: data.title,
    author: data.author.login || data.author,
    description: data.body || '',
    baseBranch: data.baseRefName,
    headBranch: data.headRefName,
    repo: repo || '',
  };
}

export async function postComment(
  prNumber: number,
  body: string,
  commitId?: string,
  path?: string,
  line?: number,
  repo?: string
): Promise<void> {
  if (path && line && commitId && repo) {
    // Review comment on a specific line using gh api
    const apiPath = `repos/${repo}/pulls/${prNumber}/comments`;
    await runGh([
      'api', apiPath,
      '-f', `body=${body}`,
      '-f', `commit_id=${commitId}`,
      '-f', `path=${path}`,
      '-F', `line=${line}`,
    ]);
  } else {
    // General PR comment
    const args = ['pr', 'comment', String(prNumber), '--body', body];
    if (repo) {
      args.push('--repo', repo);
    }
    await runGh(args);
  }
}

export async function getCurrentRepo(): Promise<string | null> {
  try {
    const stdout = await runGh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
    return stdout.trim();
  } catch {
    return null;
  }
}

export type { PRComment } from '../types/index.js';

export async function getPRComments(prNumber: number, repo: string): Promise<PRComment[]> {
  try {
    // Fetch review comments (comments on specific lines in the diff)
    const reviewComments = await getPaginatedComments(`repos/${repo}/pulls/${prNumber}/comments`);

    // Fetch issue comments (general PR comments not tied to specific lines)
    const issueComments = await getPaginatedComments(`repos/${repo}/issues/${prNumber}/comments`);

    // Combine and return all comments
    // Review comments have path/line, issue comments don't
    return [...reviewComments, ...issueComments];
  } catch (error) {
    logger.error('Failed to fetch PR comments', error);
    return [];
  }
}
