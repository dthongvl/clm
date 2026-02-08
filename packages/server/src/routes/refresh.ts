import { Hono } from 'hono';
import { getPRInfo } from '../services/gh.js';
import { fetchBranches } from '../services/git.js';
import { setPRContext } from '../services/pr-context.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  try {
    logger.operationStart(`Refreshing PR #${prNumber}`);

    const prInfo = await getPRInfo(prNumber, repo);
    await fetchBranches(prInfo.baseBranch, prInfo.headBranch);

    const baseRef = `origin/${prInfo.baseBranch}`;
    const headRef = `origin/${prInfo.headBranch}`;
    setPRContext(repo, prNumber, baseRef, headRef);

    logger.success(`PR #${prNumber} refreshed`);

    return c.json({
      prInfo,
      refs: { baseRef, headRef },
    });
  } catch (error) {
    logger.error('Failed to refresh', error);
    return c.json({ error: 'Failed to refresh', details: (error as Error).message }, 500);
  }
});

export default app;
