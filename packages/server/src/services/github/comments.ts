/**
 * PR comments — both review comments (line-anchored) and issue comments
 * (general PR conversation). All operations go through Octokit REST.
 */
import type { PRComment } from '../../types/index.js';
import { octokit } from '../../lib/octokit.js';
import { logger } from '../../lib/logger.js';
import { AppError, wrapError } from '../../lib/errors.js';
import { withGithubError, classifyOctokitError } from './errors.js';

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo "${repo}". Expected "owner/name".`);
  }
  return { owner, name };
}

export async function getPRComments(prNumber: number, repo: string): Promise<PRComment[]> {
  try {
    const { owner, name } = splitRepo(repo);
    const client = octokit();

    const [reviewComments, issueComments] = await Promise.all([
      client.paginate(client.rest.pulls.listReviewComments, {
        owner,
        repo: name,
        pull_number: prNumber,
        per_page: 100,
      }),
      client.paginate(client.rest.issues.listComments, {
        owner,
        repo: name,
        issue_number: prNumber,
        per_page: 100,
      }),
    ]);

    const mapped: PRComment[] = [
      ...reviewComments.map((c) => ({
        id: c.id,
        body: c.body ?? '',
        user: {
          login: c.user?.login ?? '',
          avatar_url: c.user?.avatar_url ?? '',
        },
        created_at: c.created_at,
        updated_at: c.updated_at,
        path: c.path,
        line: c.line ?? undefined,
        original_line: c.original_line ?? undefined,
        side: (c.side ?? undefined) as 'LEFT' | 'RIGHT' | undefined,
        in_reply_to_id: c.in_reply_to_id ?? undefined,
        diff_hunk: c.diff_hunk ?? undefined,
      })),
      ...issueComments.map((c) => ({
        id: c.id,
        body: c.body ?? '',
        user: {
          login: c.user?.login ?? '',
          avatar_url: c.user?.avatar_url ?? '',
        },
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
    ];

    return mapped;
  } catch (error) {
    logger.error('Failed to fetch PR comments', error);
    if (error instanceof AppError) throw error;
    const { code, message } = classifyOctokitError(error);
    throw wrapError(error, code, `Failed to fetch comments for PR #${prNumber}: ${message}`, {
      prNumber,
      repo,
    });
  }
}

export async function postComment(
  prNumber: number,
  body: string,
  commitId?: string,
  path?: string,
  line?: number,
  repo?: string,
): Promise<void> {
  return withGithubError(async () => {
    if (!repo) {
      throw new Error('repo is required to post a comment');
    }
    const { owner, name } = splitRepo(repo);
    const client = octokit();

    if (path && line && commitId) {
      await client.rest.pulls.createReviewComment({
        owner,
        repo: name,
        pull_number: prNumber,
        body,
        commit_id: commitId,
        path,
        line,
      });
      return;
    }

    await client.rest.issues.createComment({
      owner,
      repo: name,
      issue_number: prNumber,
      body,
    });
  });
}

export async function replyToComment(
  prNumber: number,
  commentId: number,
  body: string,
  repo: string,
): Promise<void> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    await octokit().rest.pulls.createReplyForReviewComment({
      owner,
      repo: name,
      pull_number: prNumber,
      comment_id: commentId,
      body,
    });
  });
}

export async function deleteComment(commentId: number, repo: string): Promise<void> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    await octokit().rest.pulls.deleteReviewComment({
      owner,
      repo: name,
      comment_id: commentId,
    });
  });
}

export async function editComment(
  commentId: number,
  body: string,
  repo: string,
): Promise<void> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    await octokit().rest.pulls.updateReviewComment({
      owner,
      repo: name,
      comment_id: commentId,
      body,
    });
  });
}
