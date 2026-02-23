import { Hono } from 'hono';
import { getSettings, updateSettings, validateSettingsInput } from '../services/settings.js';
import { safeJson } from '../utils/request.js';
import { wrapError } from '../lib/errors.js';

const app = new Hono();

// GET /api/settings - Get current settings
app.get('/', async (c) => {
  try {
    const settings = await getSettings();
    return c.json(settings);
  } catch (error) {
    throw wrapError(error, 'FILE_ERROR', 'Failed to get settings');
  }
});

// PUT /api/settings - Update settings (partial merge)
app.put('/', async (c) => {
  const result = await safeJson<unknown>(c);
  if (!result.ok) return result.response;

  const validation = validateSettingsInput(result.data);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  try {
    const updated = await updateSettings(validation.data);
    return c.json(updated);
  } catch (error) {
    throw wrapError(error, 'FILE_ERROR', 'Failed to update settings');
  }
});

export default app;
