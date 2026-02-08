import { Hono } from 'hono';
import { postComment, getPRComments } from '../services/gh.js';
import { safeJson, isPositiveInt } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface PostCommentBody {
  body: string;
  commitId?: string;
  path?: string;
  line?: number;
}

// GET /api/git/comments
// Fetch all comments (review comments + issue comments) for a PR
app.get('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  try {
    const comments = await getPRComments(prNumber, repo);
    return c.json({ comments });
  } catch (error) {
    logger.error('Failed to fetch comments', error);
    return c.json({ error: 'Failed to fetch comments', details: (error as Error).message }, 500);
  }
});

// POST /api/git/comments
// Body: { body: string, commitId?: string, path?: string, line?: number }
app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<PostCommentBody>(c);
  if (!result.ok) return result.response;
  
  const { body: commentBody, commitId, path, line } = result.data;

  if (!commentBody || typeof commentBody !== 'string') {
    return c.json({ error: 'body is required and must be a string' }, 400);
  }

  if (commentBody.length > 65536) {
    return c.json({ error: 'body exceeds maximum length of 65536 characters' }, 400);
  }

  // If path and line are provided, commitId is required
  if (path && line && !commitId) {
    return c.json({ error: 'commitId is required when posting a line comment' }, 400);
  }

  if (line !== undefined && !isPositiveInt(line)) {
    return c.json({ error: 'line must be a positive integer' }, 400);
  }

  try {
    logger.github(`Posting comment to PR #${prNumber}`);
    await postComment(prNumber, commentBody, commitId, path, line, repo);
    return c.json({});
  } catch (error) {
    logger.error('Failed to post comment', error);
    return c.json({ error: 'Failed to post comment', details: (error as Error).message }, 500);
  }
});

export default app;
