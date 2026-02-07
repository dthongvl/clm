import { Hono } from 'hono';
import { getSettings, updateSettings } from '../services/settings.js';
import { safeJson } from '../utils/request.js';
import { logger } from '../lib/logger.js';
import type { Settings } from '../services/settings.js';

const app = new Hono();

// GET /api/settings - Get current settings
app.get('/', async (c) => {
  try {
    const settings = await getSettings();
    return c.json(settings);
  } catch (error) {
    logger.error('Failed to get settings', error);
    return c.json({ error: 'Failed to get settings', details: (error as Error).message }, 500);
  }
});

// PUT /api/settings - Update settings (partial merge)
app.put('/', async (c) => {
  const result = await safeJson<Partial<Settings>>(c);
  if (!result.ok) return result.response;

  try {
    const updated = await updateSettings(result.data);
    return c.json(updated);
  } catch (error) {
    logger.error('Failed to update settings', error);
    return c.json({ error: 'Failed to update settings', details: (error as Error).message }, 500);
  }
});

export default app;
