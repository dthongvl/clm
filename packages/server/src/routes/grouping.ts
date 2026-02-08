import { Hono } from 'hono';
import { generateGrouping } from '../services/grouping.js';
import { buildPRLink } from '../utils/github.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  try {
    const prLink = buildPRLink(repo, prNumber);

    logger.ai(`Generating grouping for PR #${prNumber}`);

    const groupingResult = await generateGrouping(prLink);

    return c.json(groupingResult);
  } catch (error) {
    logger.error('Grouping generation failed', error);
    return c.json(
      { 
        error: 'Failed to generate grouping', 
        details: (error as Error).message 
      }, 
      500
    );
  }
});

export default app;
