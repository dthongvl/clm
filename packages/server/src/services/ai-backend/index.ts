/**
 * AiBackend factory
 *
 * Selects which AI backend to use based on the `AI_BACKEND` environment
 * variable. Defaults to `pi`.
 *
 *   AI_BACKEND=pi         (default) — runs the Pi Agent SDK in-process
 *   AI_BACKEND=opencode             — talks to a running `opencode serve`
 */

import { logger } from '../../lib/logger.js';
import { OpencodeBackend } from './opencode.js';
import { PiBackend } from './pi.js';
import type { AiBackend } from './types.js';

export type AiBackendName = 'opencode' | 'pi';

const VALID_BACKENDS: readonly AiBackendName[] = ['opencode', 'pi'];

let backend: AiBackend | null = null;

function selectBackendName(): AiBackendName {
  const raw = (process.env.AI_BACKEND || 'pi').trim().toLowerCase();
  if ((VALID_BACKENDS as readonly string[]).includes(raw)) {
    return raw as AiBackendName;
  }
  logger.warn(`Unknown AI_BACKEND="${raw}", falling back to "pi"`);
  return 'pi';
}

function createBackend(name: AiBackendName): AiBackend {
  switch (name) {
    case 'pi':
      return new PiBackend();
    case 'opencode':
    default:
      return new OpencodeBackend();
  }
}

export function getAiBackend(): AiBackend {
  if (!backend) {
    const name = selectBackendName();
    backend = createBackend(name);
    logger.info(`AI backend: ${backend.name}`);
  }
  return backend;
}

/** Test-only / advanced override. */
export function setAiBackend(custom: AiBackend | null): void {
  backend = custom;
}

export type { AiBackend, ModelOption, PromptOptions, StreamEvent } from './types.js';
