import { Hono } from 'hono';
import { safeJson } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import { wrapError } from '../lib/errors.js';
import { getPRFileViewedStates, setPRFileViewedState } from '../services/gh.js';
import type { ViewedFileState } from '../types/index.js';

const app = new Hono();

interface UpdateViewedBody {
  filePath: string;
  viewed: boolean;
}

/**
 * GET /api/git/viewed-files
 * Returns viewed states for all files in the PR
 */
app.get('/', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();
    const states = await getPRFileViewedStates(prNumber, repo);
    return c.json({ states });
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to fetch viewed files');
  }
});

/**
 * POST /api/git/viewed-files
 * Mark a file as viewed or unviewed
 */
app.post('/', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();

    const result = await safeJson<UpdateViewedBody>(c);
    if (!result.ok) return result.response;

    const { filePath, viewed } = result.data;

    if (!filePath || typeof filePath !== 'string') {
      return c.json({ error: 'filePath is required and must be a string', code: 'INVALID_INPUT' }, 400);
    }
    if (typeof viewed !== 'boolean') {
      return c.json({ error: 'viewed is required and must be a boolean', code: 'INVALID_INPUT' }, 400);
    }

    const state = await setPRFileViewedState(prNumber, repo, filePath, viewed);
    return c.json(state);
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to update viewed state');
  }
});

export default app;
