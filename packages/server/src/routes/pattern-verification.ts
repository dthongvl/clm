import { Hono } from 'hono';
import { verifyPatterns } from '../services/pattern-verification.js';

const app = new Hono();

app.get('/', async (c) => {
  const repo = c.req.query('repo');
  const prNumber = c.req.query('prNumber');

  if (!repo || !prNumber) {
    return c.json({ error: 'repo and prNumber are required' }, 400);
  }

  const prLink = `https://github.com/${repo}/pull/${prNumber}`;

  try {
    const result = await verifyPatterns(prLink);
    return c.json(result);
  } catch (error) {
    console.error('Pattern verification failed:', error);
    return c.json(
      { error: 'Failed to verify patterns', details: (error as Error).message },
      500
    );
  }
});

export default app;
