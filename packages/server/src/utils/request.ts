import type { Context } from 'hono';

/**
 * Safely parse JSON body, returning 400 on invalid JSON
 */
export async function safeJson<T>(c: Context): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    const data = await c.req.json<T>();
    return { ok: true, data };
  } catch {
    return { ok: false, response: c.json({ error: 'Invalid JSON body' }, 400) };
  }
}

/**
 * Validate that a value is a positive integer
 */
export function isPositiveInt(value: unknown): value is number {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return !Number.isNaN(parsed) && parsed >= 1;
  }
  return false;
}

/**
 * Parse a string to positive integer, returns null if invalid
 */
export function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return null;
  return parsed;
}

/**
 * Validate repo format (owner/repo)
 */
export function isValidRepo(repo: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo);
}
