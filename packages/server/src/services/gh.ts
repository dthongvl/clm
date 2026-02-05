import type { PRInfo } from '../types/index.js';
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

export interface PRComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  path?: string;
  line?: number;
  original_line?: number;
  side?: 'LEFT' | 'RIGHT';
  in_reply_to_id?: number;
  diff_hunk?: string;
}

export async function getPRComments(prNumber: number, repo: string): Promise<PRComment[]> {
  try {
    // Fetch review comments (comments on specific lines in the diff)
    const reviewStdout = await runGh(['api', `repos/${repo}/pulls/${prNumber}/comments`, '--paginate']);
    const reviewComments: PRComment[] = reviewStdout.trim() ? JSON.parse(reviewStdout) : [];

    // Fetch issue comments (general PR comments not tied to specific lines)
    const issueStdout = await runGh(['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate']);
    const issueComments: PRComment[] = issueStdout.trim() ? JSON.parse(issueStdout) : [];

    // Combine and return all comments
    // Review comments have path/line, issue comments don't
    return [...reviewComments, ...issueComments];
  } catch (error) {
    logger.error('Failed to fetch PR comments', error);
    return [];
  }
}
