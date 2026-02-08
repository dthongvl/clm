import { Hono } from 'hono';
import { findRelatedFiles } from '../services/related-files.js';
import { getCurrentRepo } from '../services/gh.js';
import { safeJson, isPositiveInt } from '../utils/request.js';
import { buildPRLink } from '../utils/github.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface RelatedFilesBody {
  prNumber: number;
  repo?: string;
}

async function handleRelatedFiles(c: import('hono').Context, prNumber: number, repo: string | undefined) {
  if (!isPositiveInt(prNumber)) {
    return c.json({ error: 'prNumber must be a positive integer' }, 400);
  }

  try {
    let targetRepo = repo;
    if (!targetRepo) {
      targetRepo = await getCurrentRepo() ?? undefined;
    }

    if (!targetRepo) {
      return c.json({ error: 'Repository is required. Provide repo in request or run from a git repository.' }, 400);
    }

    const prLink = buildPRLink(targetRepo, prNumber);

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
}

app.post('/', async (c) => {
  const result = await safeJson<RelatedFilesBody>(c);
  if (!result.ok) return result.response;
  return handleRelatedFiles(c, result.data.prNumber, result.data.repo);
});

app.post('/analyze', async (c) => {
  const result = await safeJson<RelatedFilesBody>(c);
  if (!result.ok) return result.response;
  return handleRelatedFiles(c, result.data.prNumber, result.data.repo);
});

export default app;
