import { Hono } from 'hono';
import { opencodeClient } from '../services/opencode-client.js';
import { wrapError } from '../lib/errors.js';

const app = new Hono();

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  modelId: string;
  variants: string[];
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
        const variants = Object.keys((model as { variants?: Record<string, unknown> }).variants ?? {});
        models.push({
          id: `${provider.id}/${modelId}`,
          name: model.name,
          provider: provider.name,
          providerId: provider.id,
          modelId,
          variants,
        });
      }
    }

    return c.json({ models });
  } catch (error) {
    throw wrapError(error, 'AI_ERROR', 'Failed to fetch models');
  }
});

export default app;
