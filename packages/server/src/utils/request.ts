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

const DEFAULT_ADDITIONAL_CONTEXT_MAX_LENGTH = 2000;

/**
 * Normalize and validate optional additional context from request body.
 * Returns trimmed string or undefined if empty/whitespace-only.
 */
export function normalizeAdditionalContext(
  value: unknown,
  maxLength = DEFAULT_ADDITIONAL_CONTEXT_MAX_LENGTH,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: undefined };
  if (typeof value !== 'string') {
    return { ok: false, error: 'additionalContext must be a string' };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: undefined };
  if (trimmed.length > maxLength) {
    return { ok: false, error: `additionalContext exceeds maximum length of ${maxLength}` };
  }

  return { ok: true, value: trimmed };
}
