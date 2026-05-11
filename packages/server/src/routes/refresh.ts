import { Hono } from 'hono';
import { getPRInfo } from '../services/github/index.js';
import { fetchBranches } from '../services/git.js';
import { setPRContext } from '../services/pr-context.js';
import { getAppContext } from '../lib/app-context.js';
import { wrapError } from '../lib/errors.js';
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
    throw wrapError(error, 'GH_CLI_ERROR', 'Failed to refresh PR');
  }
});

export default app;
