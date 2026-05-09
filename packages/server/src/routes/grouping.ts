import { Hono } from 'hono';
import { generateGroupingStream } from '../services/grouping.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, normalizeAdditionalContext } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';
import { streamAiResponse } from '../utils/sse.js';

interface AIActionBody {
  additionalContext?: unknown;
}

const app = new Hono();

// POST /api/ai/grouping/stream
// Server-Sent Events: emits status / thinking / tool_use / tool_result /
// text events as the agent works, ending with a `result` event carrying the
// parsed GroupingResult and a terminal `done` (or `error`).
app.post('/stream', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<AIActionBody>(c);
  if (!result.ok) return result.response;

  const contextResult = normalizeAdditionalContext(result.data.additionalContext);
  if (!contextResult.ok) {
    return c.json({ error: contextResult.error }, 400);
  }

  const prLink = buildPRLink(repo, prNumber);
  const additionalContext = contextResult.value;
  logger.ai(`Streaming grouping for PR #${prNumber}`);

  return streamAiResponse(c, () => generateGroupingStream(prLink, additionalContext));
});

export default app;
