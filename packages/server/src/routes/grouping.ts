import { Hono } from 'hono';
import { generateGrouping } from '../services/grouping.js';
import { buildPRLink } from '../utils/github.js';
import { getCurrentRepo } from '../services/gh.js';
import { safeJson, isPositiveInt } from '../utils/request.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface GroupingBody {
  prNumber: number;
  repo?: string;
}

async function handleGrouping(c: import('hono').Context, prNumber: number, repo: string | undefined) {
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
}

app.post('/', async (c) => {
  const result = await safeJson<GroupingBody>(c);
  if (!result.ok) return result.response;
  return handleGrouping(c, result.data.prNumber, result.data.repo);
});

app.post('/generate', async (c) => {
  const result = await safeJson<GroupingBody>(c);
  if (!result.ok) return result.response;
  return handleGrouping(c, result.data.prNumber, result.data.repo);
});

export default app;
