import { Hono } from 'hono';
import { generatePRReview } from '../services/ai-review.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, normalizeAdditionalContext } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { wrapError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface AIActionBody {
  additionalContext?: unknown;
}

// POST /api/ai/review/pr
// Generates a comprehensive AI review for a PR using the opencode CLI
app.post('/pr', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<AIActionBody>(c);
  if (!result.ok) return result.response;

  const contextResult = normalizeAdditionalContext(result.data.additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  try {
    const prLink = buildPRLink(repo, prNumber);
    logger.ai(`Generating PR review for #${prNumber}`);
    const reviewResult = await generatePRReview(prLink, {
      additionalContext: contextResult.value,
    });
    return c.json(reviewResult);
  } catch (error) {
    throw wrapError(error, 'AI_ERROR', 'AI PR review failed');
  }
});

export default app;
