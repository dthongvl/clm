import { Hono } from 'hono';
import { getDiff, getFileContent } from '../services/git.js';
import { getCurrentRepo } from '../services/gh.js';
import { getPRContext } from '../services/pr-context.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { parsePositiveInt } from '../utils/request.js';
import type { FileDiff } from '../types/index.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

function getEnvRefs(): { baseRef: string; headRef: string } | null {
  const baseRef = process.env.BASE_REF;
  const headRef = process.env.HEAD_REF;
  if (!baseRef || !headRef) return null;
  return { baseRef, headRef };
}

app.get('/', async (c) => {
  const prNumberStr = c.req.query('pr');
  const repo = c.req.query('repo') || process.env.REPO || await getCurrentRepo();
  const includeContent = c.req.query('includeContent') === 'true';

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  const refs = getPRContext(repo, prNumber) ?? getEnvRefs();
  if (!refs) {
    return c.json({ error: 'PR refs not found. Please refresh the PR first.' }, 400);
  }

  try {
    const files = await getDiff(refs.baseRef, refs.headRef);

    if (includeContent) {
      logger.operationStart(`Fetching content for PR #${prNumber}`);

      await mapWithConcurrency(files, 8, async (file) => {
        const baseFilename = file.oldFilename || file.filename;

        const [baseContent, headContent] = await Promise.all([
          file.status !== 'added' ? getFileContent(refs.baseRef, baseFilename) : Promise.resolve(null),
          file.status !== 'removed' ? getFileContent(refs.headRef, file.filename) : Promise.resolve(null),
        ]);

        file.baseContent = baseContent ?? undefined;
        file.headContent = headContent ?? undefined;
      });
    }

    return c.json({ files });
  } catch (error) {
    logger.error('Failed to fetch diff', error);
    return c.json({ error: 'Failed to fetch PR diff', details: (error as Error).message }, 500);
  }
});

app.get('/file', async (c) => {
  const filename = c.req.query('filename');
  const prNumberStr = c.req.query('pr');
  const repo = c.req.query('repo') || process.env.REPO || await getCurrentRepo();

  if (!filename) {
    return c.json({ error: 'filename is required' }, 400);
  }

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  const refs = getPRContext(repo, prNumber) ?? getEnvRefs();
  if (!refs) {
    return c.json({ error: 'PR refs not found. Please refresh the PR first.' }, 400);
  }

  try {
    const [baseContent, headContent] = await Promise.all([
      getFileContent(refs.baseRef, filename),
      getFileContent(refs.headRef, filename),
    ]);

    return c.json({
      filename,
      base: { ref: refs.baseRef, content: baseContent },
      head: { ref: refs.headRef, content: headContent },
    });
  } catch (error) {
    logger.error('Failed to fetch file', error);
    return c.json({ error: 'Failed to fetch file content', details: (error as Error).message }, 500);
  }
});

export default app;
