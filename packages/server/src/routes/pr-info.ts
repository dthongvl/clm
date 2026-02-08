import { Hono } from 'hono';
import { getPRInfo, checkGhCli, getCurrentRepo } from '../services/gh.js';
import { parsePositiveInt } from '../utils/request.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

// GET /api/git/pr-info?prNumber={number}&repo={owner/repo}
app.get('/', async (c) => {
  const prNumberStr = c.req.query('prNumber');
  const repo = c.req.query('repo') || await getCurrentRepo();

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

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
