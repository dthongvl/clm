import { Hono } from 'hono';
import { verifyPatterns } from '../services/pattern-verification.js';
import { buildPRLink } from '../utils/github.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  try {
    const prLink = buildPRLink(repo, prNumber);
    logger.ai(`Verifying patterns for PR #${prNumber}`);
    const verificationResult = await verifyPatterns(prLink);
    return c.json(verificationResult);
  } catch (error) {
    logger.error('Pattern verification failed', error);
    return c.json({ error: 'Failed to verify patterns', details: (error as Error).message }, 500);
  }
});

export default app;
