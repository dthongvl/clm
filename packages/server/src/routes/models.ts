import { Hono } from 'hono';
import { getAiBackend } from '../services/ai-backend/index.js';
import { wrapError } from '../lib/errors.js';

const app = new Hono();

// GET /api/models - List available models from the active AI backend
app.get('/', async (c) => {
  try {
    const models = await getAiBackend().listModels();
    return c.json({ models });
  } catch (error) {
    throw wrapError(error, 'AI_ERROR', 'Failed to fetch models');
  }
});

export default app;
