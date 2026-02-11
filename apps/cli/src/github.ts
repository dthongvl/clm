import { logger } from './logger.js';
import type { PRInfoResult, PRListItem } from './types.js';

export async function checkGhCLI(): Promise<boolean> {
  try {
    const result = await Bun.$`gh --version`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getCurrentRepo(): Promise<string | null> {
  try {
    const result = await Bun.$`gh repo view --json nameWithOwner -q .nameWithOwner`.quiet();
    if (result.exitCode === 0) {
      return result.text().trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function getPRInfo(prNumber: string, repo: string): Promise<PRInfoResult> {
  const result = await Bun.$`gh pr view ${prNumber} --repo ${repo} --json baseRefName,headRefName`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get PR info: ${result.stderr.toString()}`);
  }

  const data = JSON.parse(result.text());
  return {
    baseBranch: data.baseRefName,
    headBranch: data.headRefName,
  };
}

export async function getPRsRequestingReview(repo: string): Promise<PRListItem[]> {
  logger.step('Fetching PRs requesting your review...');

  const result = await Bun.$`gh pr list --repo ${repo} --search "is:pr is:open review-requested:@me" --json number,title,author,url,headRefName,updatedAt --limit 10`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch PRs: ${result.stderr.toString()}`);
  }

  return JSON.parse(result.text());
}
