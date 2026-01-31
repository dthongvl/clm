import { Hono } from 'hono';
import { getPRInfo, checkGhCli, getCurrentRepo } from '../services/gh.js';

const app = new Hono();

// GET /api/pr-info?pr={number}&repo={owner/repo}
app.get('/', async (c) => {
  const prNumber = c.req.query('pr');
  const repo = c.req.query('repo') || await getCurrentRepo();

  if (!prNumber) {
    return c.json({ error: 'PR number is required' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  try {
    const prInfo = await getPRInfo(parseInt(prNumber, 10), repo);
    return c.json(prInfo);
  } catch (error) {
    console.error('Failed to fetch PR info:', error);
    return c.json({ error: 'Failed to fetch PR info', details: (error as Error).message }, 500);
  }
});

// GET /api/pr-info/status
app.get('/status', async (c) => {
  const hasGh = await checkGhCli();
  const currentRepo = await getCurrentRepo();
  
  return c.json({
    ghAvailable: hasGh,
    currentRepo,
  });
});

export default app;
