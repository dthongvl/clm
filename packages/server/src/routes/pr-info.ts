import { Hono } from 'hono';
import { getPRInfo, checkGhCli, getCurrentRepo } from '../services/gh.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

// GET /api/git/pr-info
app.get('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  try {
    logger.github(`Fetching PR #${prNumber} info`);
    const prInfo = await getPRInfo(prNumber, repo);
    return c.json(prInfo);
  } catch (error) {
    logger.error('Failed to fetch PR info', error);
    return c.json({ error: 'Failed to fetch PR info', details: (error as Error).message }, 500);
  }
});

// GET /api/git/pr-info/status
app.get('/status', async (c) => {
  const hasGh = await checkGhCli();
  const currentRepo = await getCurrentRepo();

  return c.json({
    ghAvailable: hasGh,
    currentRepo,
  });
});

export default app;
