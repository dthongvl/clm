import { Hono } from 'hono';
import { postComment, getCurrentRepo } from '../services/gh.js';

const app = new Hono();

// POST /api/comments
// Body: { prNumber: number, body: string, commitId?: string, path?: string, line?: number, repo?: string }
app.post('/', async (c) => {
  const body = await c.req.json();
  const { prNumber, body: commentBody, commitId, path, line, repo: bodyRepo } = body;
  const repo = bodyRepo || await getCurrentRepo();

  if (!prNumber || !commentBody) {
    return c.json({ error: 'prNumber and body are required' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 400);
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
