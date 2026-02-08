import { Hono } from 'hono';
import { getPRInfo, getCurrentRepo } from '../services/gh.js';
import { fetchBranches } from '../services/git.js';
import { setPRContext } from '../services/pr-context.js';
import { parsePositiveInt } from '../utils/request.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

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

    const prInfo = await getPRInfo(prNumber, repo);
    await fetchBranches(prInfo.baseBranch, prInfo.headBranch);

    const baseRef = `origin/${prInfo.baseBranch}`;
    const headRef = `origin/${prInfo.headBranch}`;
    setPRContext(repo, prNumber, baseRef, headRef);

    logger.success(`PR #${prNumber} refreshed`);

    return c.json({
      success: true,
      prInfo,
      refs: { baseRef, headRef },
    });
  } catch (error) {
    logger.error('Failed to refresh', error);
    return c.json({ error: 'Failed to refresh', details: (error as Error).message }, 500);
  }
});

export default app;
