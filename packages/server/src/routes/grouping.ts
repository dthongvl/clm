import { Hono } from 'hono';
import { generateGrouping } from '../services/grouping.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, normalizeAdditionalContext } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

interface AIActionBody {
  additionalContext?: unknown;
}

const app = new Hono();

app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<AIActionBody>(c);
  if (!result.ok) return result.response;

  const contextResult = normalizeAdditionalContext(result.data.additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  const prLink = buildPRLink(repo, prNumber);
  logger.ai(`Generating grouping for PR #${prNumber}`);
  const groupingResult = await generateGrouping(prLink, contextResult.value);
  return c.json(groupingResult);
});

export default app;
