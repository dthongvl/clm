import { Hono } from 'hono';
import { findRelatedFiles } from '../services/related-files.js';
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

    logger.ai(`Finding related files for PR #${prNumber}`);

    const analysisResult = await findRelatedFiles(prLink, contextResult.value);

    return c.json(analysisResult);
  } catch (error) {
    logger.error('Related files analysis failed', error);
    return c.json(
      { 
        error: 'Failed to find related files', 
        details: (error as Error).message 
      }, 
      500
    );
  }
});

export default app;
