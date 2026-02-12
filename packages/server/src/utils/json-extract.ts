import { logger } from '../lib/logger.js';

function isValidJson(candidate: string): boolean {
  try {
    JSON.parse(candidate);
    return true;
  } catch {
    return false;
  }
}

function findBalancedJsonEnd(text: string, start: number): number {
  const first = text[start];
  if (first !== '{' && first !== '[') {
    return -1;
  }

  const stack: string[] = [first === '{' ? '}' : ']'];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      continue;
    }

    if (char === '[') {
      stack.push(']');
      continue;
    }

    if (char === '}' || char === ']') {
      const expected = stack.pop();
      if (char !== expected) {
        return -1;
      }

      if (stack.length === 0) {
        return i;
      }
    }
  }

  return -1;
}

export function extractJsonBlock(output: string): string | null {
  const trimmed = output.trim();
  if (isValidJson(trimmed)) {
    return trimmed;
  }

  const fencedJsonMatch = output.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJsonMatch?.[1]) {
    const candidate = fencedJsonMatch[1].trim();
    if (isValidJson(candidate)) {
      return candidate;
    }
  }

  const fencedMatch = output.match(/```\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    if (isValidJson(candidate)) {
      return candidate;
    }
  }

  for (let i = 0; i < output.length; i++) {
    if (output[i] !== '{' && output[i] !== '[') {
      continue;
    }

    const end = findBalancedJsonEnd(output, i);
    if (end === -1) {
      continue;
    }

    const candidate = output.slice(i, end + 1).trim();
    if (isValidJson(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function parseJsonSafe<T>(jsonContent: string): T | null {
  try {
    return JSON.parse(jsonContent) as T;
  } catch (error) {
    logger.error('JSON parse error', error);
    logger.debug(`JSON content preview: ${jsonContent.slice(0, 200)}...`);
    return null;
  }
}
