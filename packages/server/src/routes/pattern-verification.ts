import { Hono } from 'hono';
import { verifyPatterns } from '../services/pattern-verification.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, normalizeAdditionalContext } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

interface AIActionBody {
  additionalContext?: unknown;
}

const app = new Hono();

app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<AIActionBody>(c);
  if (!result.ok) return result.response;

  const contextResult = normalizeAdditionalContext(result.data.additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  try {
    const prLink = buildPRLink(repo, prNumber);
    logger.ai(`Verifying patterns for PR #${prNumber}`);
    const verificationResult = await verifyPatterns(prLink, contextResult.value);
    return c.json(verificationResult);
  } catch (error) {
    logger.error('Pattern verification failed', error);
    return c.json({ error: 'Failed to verify patterns', details: (error as Error).message }, 500);
  }
});

export default app;
