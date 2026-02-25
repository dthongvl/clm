import { Hono } from 'hono';
import { postComment, getPRComments, replyToComment, deleteComment, editComment } from '../services/gh.js';
import { safeJson, isPositiveInt } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { wrapError } from '../lib/errors.js';
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
    throw wrapError(error, 'GH_API_ERROR', 'Failed to fetch comments');
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
    throw wrapError(error, 'GH_API_ERROR', 'Failed to post comment');
  }
});

// POST /api/git/comments/:commentId/replies
// Body: { body: string }
app.post('/:commentId/replies', async (c) => {
  const { prNumber, repo } = getAppContext();
  const commentId = Number(c.req.param('commentId'));

  if (!isPositiveInt(commentId)) {
    return c.json({ error: 'commentId must be a positive integer' }, 400);
  }

  const result = await safeJson<{ body: string }>(c);
  if (!result.ok) return result.response;

  const { body: replyBody } = result.data;

  if (!replyBody || typeof replyBody !== 'string') {
    return c.json({ error: 'body is required and must be a string' }, 400);
  }

  if (replyBody.length > 65536) {
    return c.json({ error: 'body exceeds maximum length of 65536 characters' }, 400);
  }

  try {
    logger.github(`Replying to comment #${commentId} on PR #${prNumber}`);
    await replyToComment(prNumber, commentId, replyBody, repo);
    return c.json({});
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to reply to comment');
  }
});

// PATCH /api/git/comments/:commentId
// Body: { body: string }
app.patch('/:commentId', async (c) => {
  const { repo } = getAppContext();
  const commentId = Number(c.req.param('commentId'));

  if (!isPositiveInt(commentId)) {
    return c.json({ error: 'commentId must be a positive integer' }, 400);
  }

  const result = await safeJson<{ body: string }>(c);
  if (!result.ok) return result.response;

  const { body: editBody } = result.data;

  if (!editBody || typeof editBody !== 'string') {
    return c.json({ error: 'body is required and must be a string' }, 400);
  }

  if (editBody.length > 65536) {
    return c.json({ error: 'body exceeds maximum length of 65536 characters' }, 400);
  }

  try {
    logger.github(`Editing comment #${commentId}`);
    await editComment(commentId, editBody, repo);
    return c.json({});
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to edit comment');
  }
});

// DELETE /api/git/comments/:commentId
app.delete('/:commentId', async (c) => {
  const { repo } = getAppContext();
  const commentId = Number(c.req.param('commentId'));

  if (!isPositiveInt(commentId)) {
    return c.json({ error: 'commentId must be a positive integer' }, 400);
  }

  try {
    logger.github(`Deleting comment #${commentId}`);
    await deleteComment(commentId, repo);
    return c.json({});
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to delete comment');
  }
});

export default app;
