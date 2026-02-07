import { Hono } from 'hono';
import { opencodeClient } from '../services/opencode-client.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

// GET /api/models - List available models from connected providers
app.get('/', async (c) => {
  try {
    const client = opencodeClient.getClient();
    const result = await client.provider.list({});

    if (result.error || !result.data) {
      return c.json({ error: 'Failed to fetch providers' }, 500);
    }

    const { all, connected } = result.data;
    const connectedSet = new Set(connected);

    const models: ModelOption[] = [];

    for (const provider of all) {
      if (!connectedSet.has(provider.id)) continue;

      for (const [modelId, model] of Object.entries(provider.models)) {
        models.push({
          id: `${provider.id}/${modelId}`,
          name: model.name,
          provider: provider.name,
        });
      }
    }

    return c.json({ models });
  } catch (error) {
    logger.error('Failed to fetch models', error);
    return c.json({ error: 'Failed to fetch models', details: (error as Error).message }, 500);
  }
});

export default app;
