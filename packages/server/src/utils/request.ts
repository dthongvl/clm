import type { Context } from 'hono';

export const REVIEW_CATEGORIES = [
  "code-quality",
  "coding-convention",
  "security",
  "accessibility",
  "architecture",
  "api-design",
  "performance",
  "testing",
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];
export type ReviewRunMode = "combined" | "separate";

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

/**
 * Normalize and validate optional review categories from request body.
 * Returns validated array of categories, defaults to all categories if not provided.
 */
export function normalizeReviewCategories(
  value: unknown,
): { ok: true; value: ReviewCategory[] } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: [...REVIEW_CATEGORIES] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "reviewCategories must be an array of strings" };
  }

  const normalized = [...new Set(value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  )];

  if (normalized.length === 0) {
    return { ok: false, error: "reviewCategories must include at least one category" };
  }

  const invalid = normalized.find((v) => !REVIEW_CATEGORIES.includes(v as ReviewCategory));
  if (invalid) {
    return { ok: false, error: `Unknown review category: ${invalid}` };
  }

  return { ok: true, value: normalized as ReviewCategory[] };
}

/**
 * Normalize and validate optional run mode from request body.
 * Returns validated run mode, defaults to 'combined' if not provided.
 */
export function normalizeReviewRunMode(
  value: unknown,
): { ok: true; value: ReviewRunMode } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: "combined" };
  if (value !== "combined" && value !== "separate") {
    return { ok: false, error: "runMode must be 'combined' or 'separate'" };
  }
  return { ok: true, value };
}
