import type { PRInfo, PRComment, DraftReviewComment, SubmitReviewEvent, ViewedFileState, ViewedState } from '../types/index.js';
import { logger } from '../lib/logger.js';
import { AppError, classifyGhError, wrapError } from '../lib/errors.js';

/**
 * Run gh CLI command safely using Bun.spawn (no shell injection)
 */
async function runGh(args: string[], opts?: { timeoutMs?: number; input?: string }): Promise<string> {
  const proc = Bun.spawn(['gh', ...args], {
    stdin: opts?.input ? 'pipe' : null,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: opts?.timeoutMs ?? 120_000,
  });

  if (opts?.input && proc.stdin) {
    proc.stdin.write(opts.input);
    proc.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const parts = [stderr, stdout].filter(Boolean).join('\n');
    throw new Error(parts || `gh exited with code ${exitCode}`);
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
  const args = ['pr', 'view', String(prNumber), '--json', 'number,title,author,body,baseRefName,headRefName,url,state'];
  if (repo) {
    args.push('--repo', repo);
  }

  const stdout = await runGh(args);
  const data = JSON.parse(stdout);

  // gh returns state as 'OPEN' | 'MERGED' | 'CLOSED'
  const rawState = typeof data.state === 'string' ? data.state.toLowerCase() : 'open';
  const state: PRInfo['state'] =
    rawState === 'merged' || rawState === 'closed' ? rawState : 'open';

  return {
    number: data.number,
    title: data.title,
    author: data.author.login || data.author,
    description: data.body || '',
    baseBranch: data.baseRefName,
    headBranch: data.headRefName,
    repo: repo || '',
    url: data.url || '',
    state,
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

export async function replyToComment(
  prNumber: number,
  commentId: number,
  body: string,
  repo: string
): Promise<void> {
  const apiPath = `repos/${repo}/pulls/${prNumber}/comments/${commentId}/replies`;
  await runGh([
    'api', apiPath,
    '-f', `body=${body}`,
  ]);
}

export async function deleteComment(
  commentId: number,
  repo: string
): Promise<void> {
  const apiPath = `repos/${repo}/pulls/comments/${commentId}`;
  await runGh([
    'api', apiPath,
    '-X', 'DELETE',
  ]);
}

export async function editComment(
  commentId: number,
  body: string,
  repo: string
): Promise<void> {
  const apiPath = `repos/${repo}/pulls/comments/${commentId}`;
  await runGh([
    'api', apiPath,
    '-X', 'PATCH',
    '-f', `body=${body}`,
  ]);
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
    // Re-throw with context instead of swallowing the error
    throw wrapError(error, 'GH_API_ERROR', `Failed to fetch comments for PR #${prNumber}`, {
      prNumber,
      repo,
    });
  }
}

// classifyGhError is now imported from lib/errors.ts

function mapSideFromGh(side: 'LEFT' | 'RIGHT'): 'additions' | 'deletions' {
  return side === 'RIGHT' ? 'additions' : 'deletions';
}

function mapSideToGh(side: 'additions' | 'deletions'): 'RIGHT' | 'LEFT' {
  return side === 'additions' ? 'RIGHT' : 'LEFT';
}

function extractGraphQlErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const rawErrors = (result as { errors?: unknown }).errors;
  if (!Array.isArray(rawErrors) || rawErrors.length === 0) {
    return null;
  }

  const messages = rawErrors
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const message = (entry as { message?: unknown }).message;
      return typeof message === 'string' ? message : null;
    })
    .filter((message): message is string => Boolean(message));

  if (messages.length > 0) {
    return messages.join('; ');
  }

  return 'GitHub GraphQL request failed';
}

export async function getCurrentUserLogin(): Promise<string> {
  const query = `query { viewer { login } }`;
  const stdout = await runGh(['api', 'graphql', '-f', `query=${query}`]);
  const result = JSON.parse(stdout);
  return result.data.viewer.login;
}

export async function findPendingReview(
  prNumber: number,
  repo: string,
  login: string,
): Promise<{ id: string; nodeId: string; state: 'PENDING' } | null> {
  const [owner, name] = repo.split('/');
  const query = `
    query($owner: String!, $name: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $prNumber) {
          reviews(first: 100, states: PENDING) {
            nodes {
              databaseId
              id
              state
              author { login }
            }
          }
        }
      }
    }
  `;

  const stdout = await runGh([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `prNumber=${prNumber}`,
  ]);

  const result = JSON.parse(stdout);
  const reviews = result.data.repository.pullRequest.reviews.nodes as Array<{
    databaseId: number;
    id: string;
    state: string;
    author: { login: string };
  }>;

  const pending = reviews.find((r) => r.author.login === login);
  if (!pending) {
    return null;
  }
  return { id: pending.id, nodeId: pending.id, state: 'PENDING' };
}

export async function createPendingReview(
  prNumber: number,
  repo: string,
): Promise<{ id: string; nodeId: string; state: 'PENDING' }> {
  const [owner, name] = repo.split('/');
  const query = `
    query($owner: String!, $name: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $prNumber) { id }
      }
    }
  `;

  const prStdout = await runGh([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `prNumber=${prNumber}`,
  ]);
  const prResult = JSON.parse(prStdout);
  const prNodeId = prResult.data.repository.pullRequest.id as string;

  const mutation = `
    mutation($prId: ID!) {
      addPullRequestReview(input: { pullRequestId: $prId }) {
        pullRequestReview {
          databaseId
          id
          state
        }
      }
    }
  `;

  const stdout = await runGh([
    'api', 'graphql',
    '-f', `query=${mutation}`,
    '-f', `prId=${prNodeId}`,
  ]);
  const result = JSON.parse(stdout);
  const review = result.data.addPullRequestReview.pullRequestReview;
  return { id: review.id, nodeId: review.id, state: 'PENDING' };
}

export async function getPRHeadSha(prNumber: number, repo: string): Promise<string> {
  const [owner, name] = repo.split('/');
  const query = `
    query($owner: String!, $name: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $prNumber) {
          headRefOid
        }
      }
    }
  `;

  const stdout = await runGh([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `prNumber=${prNumber}`,
  ]);
  const result = JSON.parse(stdout);
  return result.data.repository.pullRequest.headRefOid;
}

export async function listPendingReviewComments(
  prNumber: number,
  repo: string,
  reviewNodeId: string,
): Promise<DraftReviewComment[]> {
  const [owner, name] = repo.split('/');
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

  const allThreadNodes: ThreadNode[] = [];
  let after: string | null = null;

  do {
    const args = [
      'api', 'graphql',
      '-f', `query=${query}`,
      '-f', `owner=${owner}`,
      '-f', `name=${name}`,
      '-F', `prNumber=${prNumber}`,
    ];
    if (after) {
      args.push('-f', `after=${after}`);
    }

    const stdout = await runGh(args);
    const result = JSON.parse(stdout);
    const threadConnection = result.data.repository.pullRequest.reviewThreads;
    allThreadNodes.push(...(threadConnection.nodes as ThreadNode[]));
    after = threadConnection.pageInfo.hasNextPage ? threadConnection.pageInfo.endCursor : null;
  } while (after);

  const comments: DraftReviewComment[] = [];
  for (const thread of allThreadNodes) {
    for (const comment of thread.comments.nodes) {
      if (comment.pullRequestReview.id !== reviewNodeId) continue;
      comments.push({
        id: comment.id,
        nodeId: comment.id,
        reviewId: comment.pullRequestReview.id,
        filePath: thread.path,
        lineNumber: comment.line ?? comment.originalLine ?? thread.line ?? thread.originalLine ?? 0,
        side: mapSideFromGh(thread.diffSide),
        content: comment.body,
        authorName: comment.author.login,
        authorAvatarUrl: comment.author.avatarUrl,
        createdAt: comment.createdAt,
      });
    }
  }

  return comments;
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
  try {
    const query = `
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
    `;

    const stdout = await runGh([
      'api', 'graphql',
      '-f', `query=${query}`,
      '-f', `reviewId=${reviewNodeId}`,
      '-f', `path=${filePath}`,
      '-F', `line=${lineNumber}`,
      '-f', `side=${mapSideToGh(side)}`,
      '-f', `body=${content}`,
    ]);

    const result = JSON.parse(stdout);
    const graphQlErrorMessage = extractGraphQlErrorMessage(result);
    if (graphQlErrorMessage) {
      throw new Error(graphQlErrorMessage);
    }

    const node = result.data?.addPullRequestReviewThread?.thread?.comments?.nodes?.[0];
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
  } catch (error) {
    const classified = classifyGhError(error);
    throw new AppError(classified.code, classified.message, { cause: error });
  }
}

/**
 * Get the current GitHub CLI authentication token.
 */
export async function getGhAuthToken(): Promise<string> {
  return (await runGh(['auth', 'token'])).trim();
}

export interface UpdatedReviewComment {
  id: string;
  nodeId: string;
  reviewId: string;
  content: string;
  authorName: string;
  authorAvatarUrl: string;
  createdAt: string;
}

export async function updatePendingReviewComment(
  commentNodeId: string,
  body: string,
): Promise<UpdatedReviewComment> {
  try {
    const mutation = `
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
    `;

    const stdout = await runGh([
      'api', 'graphql',
      '-f', `query=${mutation}`,
      '-f', `commentId=${commentNodeId}`,
      '-f', `body=${body}`,
    ]);

    const result = JSON.parse(stdout);
    const node = result.data.updatePullRequestReviewComment.pullRequestReviewComment;
    return {
      id: node.id,
      nodeId: node.id,
      reviewId: node.pullRequestReview.id,
      content: node.body,
      authorName: node.author.login,
      authorAvatarUrl: node.author.avatarUrl,
      createdAt: node.createdAt,
    };
  } catch (error) {
    const classified = classifyGhError(error);
    throw new AppError(classified.code, classified.message, { cause: error });
  }
}

export async function deletePendingReviewComment(
  commentNodeId: string,
): Promise<void> {
  try {
    const mutation = `
      mutation($commentId: ID!) {
        deletePullRequestReviewComment(input: {
          id: $commentId
        }) {
          pullRequestReviewComment { databaseId }
        }
      }
    `;

    await runGh([
      'api', 'graphql',
      '-f', `query=${mutation}`,
      '-f', `commentId=${commentNodeId}`,
    ]);
  } catch (error) {
    const classified = classifyGhError(error);
    throw new AppError(classified.code, classified.message, { cause: error });
  }
}

export async function submitPendingReview(
  prNumber: number,
  repo: string,
  reviewNodeId: string,
  event: SubmitReviewEvent,
  body?: string,
): Promise<void> {
  try {
    const eventMap: Record<SubmitReviewEvent, string> = {
      COMMENT: 'COMMENT',
      REQUEST_CHANGES: 'REQUEST_CHANGES',
      APPROVE: 'APPROVE',
    };

    const mutation = `
      mutation($reviewId: ID!, $event: PullRequestReviewEvent!, $body: String) {
        submitPullRequestReview(input: {
          pullRequestReviewId: $reviewId
          event: $event
          body: $body
        }) {
          pullRequestReview { state }
        }
      }
    `;

    const args = [
      'api', 'graphql',
      '-f', `query=${mutation}`,
      '-f', `reviewId=${reviewNodeId}`,
      '-f', `event=${eventMap[event]}`,
    ];
    if (body) {
      args.push('-f', `body=${body}`);
    }
    await runGh(args);
  } catch (error) {
    const classified = classifyGhError(error);
    throw new AppError(classified.code, classified.message, { cause: error });
  }
}

/**
 * Get the GraphQL node ID for a PR
 */
export async function getPRNodeId(prNumber: number, repo: string): Promise<string> {
  const [owner, name] = repo.split('/');
  const query = `
    query($owner: String!, $name: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $prNumber) { id }
      }
    }
  `;

  const stdout = await runGh([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `prNumber=${prNumber}`,
  ]);
  const result = JSON.parse(stdout);
  return result.data.repository.pullRequest.id as string;
}

/**
 * Get viewed state for all files in a PR with pagination
 */
export async function getPRFileViewedStates(
  prNumber: number,
  repo: string,
): Promise<ViewedFileState[]> {
  const [owner, name] = repo.split('/');
  const query = `
    query($owner: String!, $name: String!, $prNumber: Int!, $after: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $prNumber) {
          files(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              path
              viewerViewedState
            }
          }
        }
      }
    }
  `;

  type FileNode = {
    path: string;
    viewerViewedState: ViewedState;
  };

  const allFiles: ViewedFileState[] = [];
  let after: string | null = null;

  do {
    const args = [
      'api', 'graphql',
      '-f', `query=${query}`,
      '-f', `owner=${owner}`,
      '-f', `name=${name}`,
      '-F', `prNumber=${prNumber}`,
    ];
    if (after) {
      args.push('-f', `after=${after}`);
    }

    const stdout = await runGh(args);
    const result = JSON.parse(stdout);
    const filesConnection = result.data.repository.pullRequest.files;

    for (const file of filesConnection.nodes as FileNode[]) {
      allFiles.push({
        path: file.path,
        state: file.viewerViewedState,
      });
    }

    after = filesConnection.pageInfo.hasNextPage ? filesConnection.pageInfo.endCursor : null;
  } while (after);

  return allFiles;
}

/**
 * Set viewed state for a file in a PR
 */
export async function setPRFileViewedState(
  prNumber: number,
  repo: string,
  filePath: string,
  viewed: boolean,
): Promise<ViewedFileState> {
  try {
    const prNodeId = await getPRNodeId(prNumber, repo);

    const mutation = viewed
      ? `
        mutation($prId: ID!, $path: String!) {
          markFileAsViewed(input: { pullRequestId: $prId, path: $path }) {
            pullRequest {
              files(first: 1, after: null) {
                nodes { path viewerViewedState }
              }
            }
          }
        }
      `
      : `
        mutation($prId: ID!, $path: String!) {
          unmarkFileAsViewed(input: { pullRequestId: $prId, path: $path }) {
            pullRequest {
              files(first: 1, after: null) {
                nodes { path viewerViewedState }
              }
            }
          }
        }
      `;

    await runGh([
      'api', 'graphql',
      '-f', `query=${mutation}`,
      '-f', `prId=${prNodeId}`,
      '-f', `path=${filePath}`,
    ]);

    // Return the expected state since the mutation doesn't return the specific file
    return {
      path: filePath,
      state: viewed ? 'VIEWED' : 'UNVIEWED',
    };
  } catch (error) {
    const classified = classifyGhError(error);
    throw new AppError(classified.code, classified.message, { cause: error });
  }
}
