import { parse as parseYaml } from 'yaml';
import { logger } from '../lib/logger.js';

export function extractYamlBlock(output: string, fallbackKeys: string[] = []): string | null {
  const fenceMatch = output.match(/```ya?ml\n([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1];

  for (const key of fallbackKeys) {
    const rawMatch = output.match(new RegExp(`^(${key}:[\\s\\S]*)`, 'm'));
    if (rawMatch?.[1]) return rawMatch[1];
  }

  return null;
}

export function parseYamlSafe<T>(yamlContent: string): T | null {
  try {
    return parseYaml(yamlContent) as T;
  } catch (error) {
    // Log YAML parse errors for debugging
    logger.error('YAML parse error', error);
    logger.debug(`YAML content preview: ${yamlContent.slice(0, 200)}...`);
    return null;
  }
}
