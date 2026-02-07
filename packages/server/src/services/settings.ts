import { parse, stringify } from 'smol-toml';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { logger } from '../lib/logger.js';

const CONFIG_DIR = join(homedir(), '.config', 'codereview');
const CONFIG_FILE = join(CONFIG_DIR, 'settings.toml');

export type ActionKey = 'grouping' | 'ai-review' | 'pattern-verification' | 'related-files';

export const ACTION_KEYS: ActionKey[] = ['grouping', 'ai-review', 'pattern-verification', 'related-files'];

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

export interface ActionSettings {
  model?: string;
}

export interface Settings {
  grouping?: ActionSettings;
  'ai-review'?: ActionSettings;
  'pattern-verification'?: ActionSettings;
  'related-files'?: ActionSettings;
}

function getDefaults(): Settings {
  return {
    grouping: { model: DEFAULT_MODEL },
    'ai-review': { model: DEFAULT_MODEL },
    'pattern-verification': { model: DEFAULT_MODEL },
    'related-files': { model: DEFAULT_MODEL },
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = parse(content) as Settings;
    // Merge with defaults so missing keys are filled
    const defaults = getDefaults();
    for (const key of ACTION_KEYS) {
      if (!parsed[key]) {
        parsed[key] = defaults[key];
      } else if (!parsed[key]!.model) {
        parsed[key]!.model = defaults[key]!.model;
      }
    }
    return parsed;
  } catch {
    // File doesn't exist or is invalid — return defaults
    return getDefaults();
  }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();

  for (const key of ACTION_KEYS) {
    if (partial[key]) {
      current[key] = { ...current[key], ...partial[key] };
    }
  }

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, stringify(current as Record<string, unknown>), 'utf-8');
  logger.info(`Settings saved to ${CONFIG_FILE}`);

  return current;
}

export async function getModelForAction(action: ActionKey): Promise<string> {
  const settings = await getSettings();
  return settings[action]?.model || DEFAULT_MODEL;
}
