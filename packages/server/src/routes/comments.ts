import { Hono } from 'hono';
import { postComment, getCurrentRepo, getPRComments } from '../services/gh.js';
import { safeJson, parsePositiveInt, isPositiveInt } from '../utils/request.js';

const app = new Hono();

interface PostCommentBody {
  prNumber: number;
  body: string;
  commitId?: string;
  path?: string;
  line?: number;
  repo?: string;
}

// GET /api/comments?pr={number}&repo={owner/repo}
// Fetch all comments (review comments + issue comments) for a PR
app.get('/', async (c) => {
  const prNumberStr = c.req.query('pr');
  const queryRepo = c.req.query('repo');
  const repo = queryRepo || await getCurrentRepo();

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'pr query parameter must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 400);
  }

  try {
    const comments = await getPRComments(prNumber, repo);
    return c.json({ comments });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return c.json({ error: 'Failed to fetch comments', details: (error as Error).message }, 500);
  }
});

// POST /api/comments
// Body: { prNumber: number, body: string, commitId?: string, path?: string, line?: number, repo?: string }
app.post('/', async (c) => {
  const result = await safeJson<PostCommentBody>(c);
  if (!result.ok) return result.response;
  
  const { prNumber, body: commentBody, commitId, path, line, repo: bodyRepo } = result.data;
  const repo = bodyRepo || await getCurrentRepo();

  if (!isPositiveInt(prNumber)) {
    return c.json({ error: 'prNumber must be a positive integer' }, 400);
  }

  if (!commentBody || typeof commentBody !== 'string') {
    return c.json({ error: 'body is required and must be a string' }, 400);
  }

  if (commentBody.length > 65536) {
    return c.json({ error: 'body exceeds maximum length of 65536 characters' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 400);
  }

  // If path and line are provided, commitId is required
  if (path && line && !commitId) {
    return c.json({ error: 'commitId is required when posting a line comment' }, 400);
  }

  if (line !== undefined && !isPositiveInt(line)) {
    return c.json({ error: 'line must be a positive integer' }, 400);
  }

  try {
    await postComment(prNumber, commentBody, commitId, path, line, repo);
    return c.json({ success: true, message: 'Comment posted successfully' });
  } catch (error) {
    console.error('Failed to post comment:', error);
    return c.json({ error: 'Failed to post comment', details: (error as Error).message }, 500);
  }
});

export default app;
