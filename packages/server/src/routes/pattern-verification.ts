import { Hono } from 'hono';
import { verifyPatterns } from '../services/pattern-verification.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

app.get('/', async (c) => {
  const repo = c.req.query('repo');
  const prNumber = c.req.query('prNumber');

  if (!repo || !prNumber) {
    return c.json({ error: 'repo and prNumber are required' }, 400);
  }

  const prLink = `https://github.com/${repo}/pull/${prNumber}`;

  try {
    logger.ai(`Verifying patterns for PR #${prNumber}`);
    const result = await verifyPatterns(prLink);
    return c.json(result);
  } catch (error) {
    logger.error('Pattern verification failed', error);
    return c.json(
      { error: 'Failed to verify patterns', details: (error as Error).message },
      500
    );
  }
});

export default app;
