import { select } from '@inquirer/prompts';
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
  const choices = prs.map((pr) => ({
    name: `#${pr.number} ${pr.title.slice(0, 60)}${pr.title.length > 60 ? '...' : ''} (${pr.author.login}, ${formatRelativeTime(pr.updatedAt)})`,
    value: pr,
  }));

  const selected = await select({
    message: 'Select a PR to review:',
    choices,
    pageSize: 10,
  });

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
