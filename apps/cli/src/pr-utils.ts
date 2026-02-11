import * as p from '@clack/prompts';
import type { PRListItem, ParsedPRInput } from './types.js';

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'just now';
}

export async function selectPR(prs: PRListItem[]): Promise<PRListItem> {
  const options = prs.map((pr) => ({
    label: `#${pr.number} ${pr.title.slice(0, 60)}${pr.title.length > 60 ? '...' : ''} (${pr.author.login}, ${formatRelativeTime(pr.updatedAt)})`,
    value: pr,
  }));

  const selected = await p.select({
    message: 'Select a PR to review:',
    options,
  });

  if (p.isCancel(selected)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return selected;
}

export function parsePRInput(input: string): ParsedPRInput {
  // Try to parse as GitHub PR URL
  // Supports: https://github.com/owner/repo/pull/123
  //           github.com/owner/repo/pull/123
  //           http://github.com/owner/repo/pull/123
  const urlPattern = /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/;
  const match = input.match(urlPattern);

  if (match && match[1] && match[2]) {
    return {
      prNumber: match[2],
      repo: match[1],
    };
  }

  // If not a URL, treat as PR number
  return { prNumber: input };
}
