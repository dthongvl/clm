import { Hono } from 'hono';
import { findRelatedFiles } from '../services/related-files.js';
import { buildPRLink } from '../utils/github.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  try {
    const prLink = buildPRLink(repo, prNumber);

    logger.ai(`Finding related files for PR #${prNumber}`);

    const analysisResult = await findRelatedFiles(prLink);

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
