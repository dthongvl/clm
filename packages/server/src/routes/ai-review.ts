import { Hono } from 'hono';
import { reviewDiff, reviewLine, checkAIBinary } from '../services/ai.js';
import { generatePRReview } from '../services/ai-review.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, isPositiveInt, normalizeAdditionalContext, normalizeReviewCategories, normalizeReviewRunMode } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface DiffReviewBody {
  diff: string;
  fileContext?: Array<{ filename: string; content: string }>;
}

interface LineReviewBody {
  filename: string;
  line: number;
  code: string;
  diff?: string;
}

interface AIActionBody {
  additionalContext?: unknown;
  reviewCategories?: unknown;
  runMode?: unknown;
}

// POST /api/ai/review
// Body: { diff: string, fileContext?: Array<{filename, content}> }
app.post('/', async (c) => {
  const hasAI = await checkAIBinary();
  if (!hasAI) {
    return c.json({ error: 'AI binary not available. Please install and configure the AI CLI.' }, 503);
  }

  const result = await safeJson<DiffReviewBody>(c);
  if (!result.ok) return result.response;
  
  const { diff, fileContext } = result.data;

  if (!diff || typeof diff !== 'string') {
    return c.json({ error: 'diff is required and must be a string' }, 400);
  }

  if (diff.length > 500000) {
    return c.json({ error: 'diff exceeds maximum length of 500000 characters' }, 400);
  }

  try {
    logger.ai('Running diff review');
    const reviewResult = await reviewDiff(diff, fileContext);
    return c.json(reviewResult);
  } catch (error) {
    logger.error('AI review failed', error);
    return c.json({ error: 'AI review failed', details: (error as Error).message }, 500);
  }
});

// POST /api/ai/review/line
// Body: { filename: string, line: number, code: string, diff?: string }
app.post('/line', async (c) => {
  const hasAI = await checkAIBinary();
  if (!hasAI) {
    return c.json({ error: 'AI binary not available' }, 503);
  }

  const result = await safeJson<LineReviewBody>(c);
  if (!result.ok) return result.response;
  
  const { filename, line, code, diff } = result.data;

  if (!filename || typeof filename !== 'string') {
    return c.json({ error: 'filename is required and must be a string' }, 400);
  }

  if (!isPositiveInt(line)) {
    return c.json({ error: 'line must be a positive integer' }, 400);
  }

  if (!code || typeof code !== 'string') {
    return c.json({ error: 'code is required and must be a string' }, 400);
  }

  try {
    logger.ai(`Reviewing line ${line} in ${filename}`);
    const comment = await reviewLine(filename, line, code, diff);
    return c.json({ comment });
  } catch (error) {
    logger.error('Line review failed', error);
    return c.json({ error: 'Line review failed', details: (error as Error).message }, 500);
  }
});

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

  const categoriesResult = normalizeReviewCategories(result.data.reviewCategories);
  if (!categoriesResult.ok) {
    return c.json({ error: categoriesResult.error }, 400);
  }

  const runModeResult = normalizeReviewRunMode(result.data.runMode);
  if (!runModeResult.ok) {
    return c.json({ error: runModeResult.error }, 400);
  }

  try {
    const prLink = buildPRLink(repo, prNumber);
    logger.ai(`Generating PR review for #${prNumber}`);
    const reviewResult = await generatePRReview(prLink, {
      additionalContext: contextResult.value,
      reviewCategories: categoriesResult.value,
      runMode: runModeResult.value,
    });
    return c.json(reviewResult);
  } catch (error) {
    logger.error('AI PR review failed', error);
    return c.json({ error: 'AI PR review failed', details: (error as Error).message }, 500);
  }
});

export default app;
