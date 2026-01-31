import { Hono } from 'hono';
import { reviewDiff, reviewLine, checkAIBinary } from '../services/ai.js';
import type { AIReviewResult } from '../types/index.js';

const app = new Hono();

// POST /api/ai-review
// Body: { diff: string, fileContext?: Array<{filename, content}> }
app.post('/', async (c) => {
  const hasAI = await checkAIBinary();
  if (!hasAI) {
    return c.json({ error: 'AI binary not available. Please install and configure the AI CLI.' }, 503);
  }

  const body = await c.req.json();
  const { diff, fileContext } = body;

  if (!diff) {
    return c.json({ error: 'diff is required' }, 400);
  }

  try {
    const result = await reviewDiff(diff, fileContext);
    return c.json(result);
  } catch (error) {
    console.error('AI review failed:', error);
    return c.json({ error: 'AI review failed', details: (error as Error).message }, 500);
  }
});

// POST /api/ai-review/line
// Body: { filename: string, line: number, code: string, diff?: string }
app.post('/line', async (c) => {
  const hasAI = await checkAIBinary();
  if (!hasAI) {
    return c.json({ error: 'AI binary not available' }, 503);
  }

  const body = await c.req.json();
  const { filename, line, code, diff } = body;

  if (!filename || !line || !code) {
    return c.json({ error: 'filename, line, and code are required' }, 400);
  }

  try {
    const comment = await reviewLine(filename, line, code, diff);
    return c.json({ comment });
  } catch (error) {
    console.error('Line review failed:', error);
    return c.json({ error: 'Line review failed', details: (error as Error).message }, 500);
  }
});

// GET /api/ai-review/status
app.get('/status', async (c) => {
  const hasAI = await checkAIBinary();
  const aiBinary = process.env.AI_BINARY || 'claude';
  
  return c.json({
    available: hasAI,
    binary: aiBinary,
  });
});

export default app;
