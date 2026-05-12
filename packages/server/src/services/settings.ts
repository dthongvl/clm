import { parse, stringify } from 'smol-toml';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

const CONFIG_DIR = join(homedir(), '.config', 'clm');
const CONFIG_FILE = join(CONFIG_DIR, 'settings.toml');

export type ActionKey = 'grouping' | 'ai-review' | 'review-guide';

export const ACTION_KEYS: ActionKey[] = ['grouping', 'ai-review', 'review-guide'];

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

const thinkingLevelSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh']);

const actionSettingsSchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
  thinkingLevel: thinkingLevelSchema.optional(),
}).strict();

const themeSchema = z.enum(['light', 'dark', 'system']);

const settingsSchema = z.object({
  grouping: actionSettingsSchema.optional(),
  'ai-review': actionSettingsSchema.optional(),
  'review-guide': actionSettingsSchema.optional(),
  theme: themeSchema.optional(),
}).strict();

export type ActionSettings = z.infer<typeof actionSettingsSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

let settingsCache: { settings: Settings; expiresAt: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 30_000;

function getDefaults(): Settings {
  return {
    grouping: { model: DEFAULT_MODEL },
    'ai-review': { model: DEFAULT_MODEL },
    'review-guide': { model: DEFAULT_MODEL },
  };
}

export async function getSettings(): Promise<Settings> {
  if (settingsCache && Date.now() < settingsCache.expiresAt) {
    return settingsCache.settings;
  }

  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = parse(content) as Settings;
    const defaults = getDefaults();
    for (const key of ACTION_KEYS) {
      if (!parsed[key]) {
        parsed[key] = defaults[key];
      } else if (!parsed[key]!.model) {
        parsed[key]!.model = defaults[key]!.model;
      }
    }
    settingsCache = { settings: parsed, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return parsed;
  } catch (error) {
    // Log error for debugging - helps distinguish missing file vs parse error vs permission error
    logger.debug(`Failed to load settings from ${CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    const defaults = getDefaults();
    settingsCache = { settings: defaults, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return defaults;
  }
}

const settingsInputSchema = settingsSchema.partial();

export function validateSettingsInput(
  input: unknown,
): { ok: true; data: Partial<Settings> } | { ok: false; error: string } {
  const result = settingsInputSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, data: result.data };
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();

  for (const key of ACTION_KEYS) {
    if (partial[key]) {
      current[key] = { ...current[key], ...partial[key] };
    }
  }

  if (partial.theme !== undefined) {
    current.theme = partial.theme;
  }

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, stringify(current as Record<string, unknown>), 'utf-8');
  settingsCache = null;
  logger.info(`Settings saved to ${CONFIG_FILE}`);

  return current;
}

export async function getModelForAction(action: ActionKey): Promise<string> {
  const settings = await getSettings();
  return settings[action]?.model || DEFAULT_MODEL;
}

export async function getVariantForAction(action: ActionKey): Promise<string | undefined> {
  const settings = await getSettings();
  return settings[action]?.variant;
}

export async function getThinkingLevelForAction(action: ActionKey): Promise<ThinkingLevel | undefined> {
  const settings = await getSettings();
  return settings[action]?.thinkingLevel;
}
