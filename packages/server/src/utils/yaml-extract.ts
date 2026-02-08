import { parse as parseYaml } from 'yaml';

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
  } catch {
    return null;
  }
}
