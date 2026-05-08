import { Hono } from 'hono';
import { generatePRReview, generatePRReviewStream } from '../services/ai-review.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, normalizeAdditionalContext } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { wrapError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { streamAiResponse } from '../utils/sse.js';

const app = new Hono();

interface AIActionBody {
  additionalContext?: unknown;
}

// POST /api/ai/review/pr
// Generates a comprehensive AI review for a PR (blocking, returns final JSON).
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

// POST /api/ai/review/pr/stream
// Server-Sent Events variant: emits status / thinking / tool_use / tool_result /
// text events as the agent works, ending with a `result` event carrying the
// parsed AIReviewPRResult and a terminal `done` (or `error`).
app.post('/pr/stream', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<AIActionBody>(c);
  if (!result.ok) return result.response;

  const contextResult = normalizeAdditionalContext(result.data.additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  const prLink = buildPRLink(repo, prNumber);
  const additionalContext = contextResult.value;
  logger.ai(`Streaming PR review for #${prNumber}`);

  return streamAiResponse(c, () => generatePRReviewStream(prLink, { additionalContext }));
});

export default app;
