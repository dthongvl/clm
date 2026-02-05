import { Hono } from 'hono';
import { getPRInfo, getCurrentRepo } from '../services/gh.js';
import { fetchBranches } from '../services/git.js';
import { parsePositiveInt } from '../utils/request.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

// POST /api/refresh?pr={number}&repo={owner/repo}
// Refreshes PR info and fetches the latest branches from origin
app.post('/', async (c) => {
  const prNumberStr = c.req.query('pr');
  const repo = c.req.query('repo') || process.env.REPO || await getCurrentRepo();

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  try {
    logger.operationStart(`Refreshing PR #${prNumber}`);
    
    // Get latest PR info from GitHub
    const prInfo = await getPRInfo(prNumber, repo);

    // Fetch the branches from origin
    await fetchBranches(prInfo.baseBranch, prInfo.headBranch);

    // Update environment variables for subsequent requests
    process.env.BASE_REF = `origin/${prInfo.baseBranch}`;
    process.env.HEAD_REF = `origin/${prInfo.headBranch}`;

    logger.success(`PR #${prNumber} refreshed`);

    return c.json({
      success: true,
      prInfo,
      refs: {
        baseRef: process.env.BASE_REF,
        headRef: process.env.HEAD_REF,
      },
    });
  } catch (error) {
    logger.error('Failed to refresh', error);
    return c.json({ error: 'Failed to refresh', details: (error as Error).message }, 500);
  }
});

export default app;
