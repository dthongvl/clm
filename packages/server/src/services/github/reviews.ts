/**
 * Pending review (draft review) lifecycle: create, list comments, add/update/
 * delete pending comments, submit. All operations use the GitHub GraphQL API
 * via Octokit because review threads/drafts are GraphQL-native.
 */
import type { DraftReviewComment, SubmitReviewEvent } from '../../types/index.js';
import { gql } from '../../lib/octokit.js';
import { withGithubError } from './errors.js';
import { getPRNodeId } from './pull-request.js';

export interface UpdatedReviewComment {
  id: string;
  nodeId: string;
  reviewId: string;
  content: string;
  authorName: string;
  authorAvatarUrl: string;
  createdAt: string;
}

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo "${repo}". Expected "owner/name".`);
  }
  return { owner, name };
}

function mapSideFromGh(side: 'LEFT' | 'RIGHT'): 'additions' | 'deletions' {
  return side === 'RIGHT' ? 'additions' : 'deletions';
}

function mapSideToGh(side: 'additions' | 'deletions'): 'RIGHT' | 'LEFT' {
  return side === 'additions' ? 'RIGHT' : 'LEFT';
}

export async function findPendingReview(
  prNumber: number,
  repo: string,
  login: string,
): Promise<{ id: string; nodeId: string; state: 'PENDING' } | null> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    type ReviewNode = {
      databaseId: number;
      id: string;
      state: string;
      author: { login: string };
    };

    const result = await gql()<{
      repository: { pullRequest: { reviews: { nodes: ReviewNode[] } } };
    }>(
      `
        query($owner: String!, $name: String!, $prNumber: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $prNumber) {
              reviews(first: 100, states: PENDING) {
                nodes { databaseId id state author { login } }
              }
            }
          }
        }
      `,
      { owner, name, prNumber },
    );

    const pending = result.repository.pullRequest.reviews.nodes.find(
      (r) => r.author.login === login,
    );
    if (!pending) return null;
    return { id: pending.id, nodeId: pending.id, state: 'PENDING' };
  });
}

export async function createPendingReview(
  prNumber: number,
  repo: string,
): Promise<{ id: string; nodeId: string; state: 'PENDING' }> {
  return withGithubError(async () => {
    const prNodeId = await getPRNodeId(prNumber, repo);

    const result = await gql()<{
      addPullRequestReview: {
        pullRequestReview: { databaseId: number; id: string; state: string };
      };
    }>(
      `
        mutation($prId: ID!) {
          addPullRequestReview(input: { pullRequestId: $prId }) {
            pullRequestReview { databaseId id state }
          }
        }
      `,
      { prId: prNodeId },
    );

    const review = result.addPullRequestReview.pullRequestReview;
    return { id: review.id, nodeId: review.id, state: 'PENDING' };
  });
}

export async function listPendingReviewComments(
  prNumber: number,
  repo: string,
  reviewNodeId: string,
): Promise<DraftReviewComment[]> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);

    type ThreadNode = {
      diffSide: 'LEFT' | 'RIGHT';
      line: number | null;
      originalLine: number | null;
      path: string;
      comments: {
        nodes: Array<{
          databaseId: number;
          id: string;
          body: string;
          line: number | null;
          originalLine: number | null;
          author: { login: string; avatarUrl: string };
          createdAt: string;
          pullRequestReview: { id: string };
        }>;
      };
    };

    const query = `
      query($owner: String!, $name: String!, $prNumber: Int!, $after: String) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $prNumber) {
            reviewThreads(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                diffSide
                line
                originalLine
                path
                comments(first: 100) {
                  nodes {
                    databaseId
                    id
                    body
                    line
                    originalLine
                    author { login avatarUrl }
                    createdAt
                    pullRequestReview { id }
                  }
                }
              }
            }
          }
        }
      }
    `;

    type ThreadConn = {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ThreadNode[];
    };
    type ThreadResult = {
      repository: { pullRequest: { reviewThreads: ThreadConn } };
    };

    const allThreads: ThreadNode[] = [];
    let after: string | null = null;
    const client = gql();

    do {
      const result: ThreadResult = await client<ThreadResult>(query, {
        owner,
        name,
        prNumber,
        after,
      });

      const conn: ThreadConn = result.repository.pullRequest.reviewThreads;
      allThreads.push(...conn.nodes);
      after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (after);

    const comments: DraftReviewComment[] = [];
    for (const thread of allThreads) {
      for (const c of thread.comments.nodes) {
        if (c.pullRequestReview.id !== reviewNodeId) continue;
        comments.push({
          id: c.id,
          nodeId: c.id,
          reviewId: c.pullRequestReview.id,
          filePath: thread.path,
          lineNumber:
            c.line ?? c.originalLine ?? thread.line ?? thread.originalLine ?? 0,
          side: mapSideFromGh(thread.diffSide),
          content: c.body,
          authorName: c.author.login,
          authorAvatarUrl: c.author.avatarUrl,
          createdAt: c.createdAt,
        });
      }
    }

    return comments;
  });
}

export async function createPendingReviewComment(
  prNumber: number,
  repo: string,
  filePath: string,
  lineNumber: number,
  side: 'additions' | 'deletions',
  content: string,
  reviewNodeId: string,
): Promise<DraftReviewComment> {
  return withGithubError(async () => {
    type Node = {
      databaseId: number;
      id: string;
      body: string;
      path: string;
      line: number | null;
      author: { login: string; avatarUrl: string };
      createdAt: string;
      pullRequestReview: { id: string };
    };

    const result = await gql()<{
      addPullRequestReviewThread: {
        thread: { comments: { nodes: Node[] } };
      };
    }>(
      `
        mutation($reviewId: ID!, $path: String!, $line: Int!, $side: DiffSide!, $body: String!) {
          addPullRequestReviewThread(input: {
            pullRequestReviewId: $reviewId
            path: $path
            line: $line
            side: $side
            body: $body
          }) {
            thread {
              comments(first: 1) {
                nodes {
                  databaseId
                  id
                  body
                  path
                  line: originalLine
                  author { login avatarUrl }
                  createdAt
                  pullRequestReview { id }
                }
              }
            }
          }
        }
      `,
      {
        reviewId: reviewNodeId,
        path: filePath,
        line: lineNumber,
        side: mapSideToGh(side),
        body: content,
      },
    );

    void prNumber;
    void repo;

    const node = result.addPullRequestReviewThread?.thread?.comments?.nodes?.[0];
    if (!node) {
      throw new Error('GitHub did not return a review thread comment');
    }

    return {
      id: node.id,
      nodeId: node.id,
      reviewId: node.pullRequestReview.id,
      filePath: node.path,
      lineNumber: node.line ?? lineNumber,
      side,
      content: node.body,
      authorName: node.author.login,
      authorAvatarUrl: node.author.avatarUrl,
      createdAt: node.createdAt,
    };
  });
}

export async function updatePendingReviewComment(
  commentNodeId: string,
  body: string,
): Promise<UpdatedReviewComment> {
  return withGithubError(async () => {
    const result = await gql()<{
      updatePullRequestReviewComment: {
        pullRequestReviewComment: {
          databaseId: number;
          id: string;
          body: string;
          author: { login: string; avatarUrl: string };
          createdAt: string;
          pullRequestReview: { id: string };
        };
      };
    }>(
      `
        mutation($commentId: ID!, $body: String!) {
          updatePullRequestReviewComment(input: {
            pullRequestReviewCommentId: $commentId
            body: $body
          }) {
            pullRequestReviewComment {
              databaseId
              id
              body
              author { login avatarUrl }
              createdAt
              pullRequestReview { id }
            }
          }
        }
      `,
      { commentId: commentNodeId, body },
    );

    const node = result.updatePullRequestReviewComment.pullRequestReviewComment;
    return {
      id: node.id,
      nodeId: node.id,
      reviewId: node.pullRequestReview.id,
      content: node.body,
      authorName: node.author.login,
      authorAvatarUrl: node.author.avatarUrl,
      createdAt: node.createdAt,
    };
  });
}

export async function deletePendingReviewComment(commentNodeId: string): Promise<void> {
  return withGithubError(async () => {
    await gql()(
      `
        mutation($commentId: ID!) {
          deletePullRequestReviewComment(input: { id: $commentId }) {
            pullRequestReviewComment { databaseId }
          }
        }
      `,
      { commentId: commentNodeId },
    );
  });
}

export async function submitPendingReview(
  prNumber: number,
  repo: string,
  reviewNodeId: string,
  event: SubmitReviewEvent,
  body?: string,
): Promise<void> {
  return withGithubError(async () => {
    void prNumber;
    void repo;
    await gql()(
      `
        mutation($reviewId: ID!, $event: PullRequestReviewEvent!, $body: String) {
          submitPullRequestReview(input: {
            pullRequestReviewId: $reviewId
            event: $event
            body: $body
          }) {
            pullRequestReview { state }
          }
        }
      `,
      { reviewId: reviewNodeId, event, body: body ?? null },
    );
  });
}
