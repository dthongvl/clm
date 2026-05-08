/**
 * PiBackend
 *
 * AiBackend implementation backed by the Pi Agent SDK
 * (@mariozechner/pi-coding-agent), running in-process inside the Hono server.
 *
 * Each `prompt()` call spins up an ephemeral AgentSession with a read-only
 * tool set (Read/Bash/Grep/Find/LS) so the agent can drive `gh` and `git`
 * locally — matching the workflow opencode used to perform.
 *
 * Pi SDK modules are loaded dynamically so installs that only use the
 * OpenCode backend don't pay the import cost.
 */

import { logger } from '../../lib/logger.js';
import type { AiBackend, ModelOption, PromptOptions, StreamEvent } from './types.js';

// Loose Pi SDK shapes (we don't depend on the SDK types at compile time).
type PiAuthStorage = {
  set(provider: string, credential: { type: 'api_key'; key: string }): void;
};
type PiModel = { id: string; name?: string; provider: string };
type PiModelRegistry = {
  find(provider: string, id: string): PiModel | undefined;
  getAll(): PiModel[];
};
/**
 * Loose mirror of `AgentSessionEvent` from `@mariozechner/pi-agent-core`. We carry only
 * the fields we read so the SDK's full type tree doesn't leak into our build.
 */
type PiAgentSessionEvent = {
  type: string;
  // message_start | message_update | message_end
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
    stopReason?: string;
    errorMessage?: string;
  };
  // message_update — nested AssistantMessageEvent from @mariozechner/pi-ai
  assistantMessageEvent?: {
    type: string;
    delta?: string;
    error?: { errorMessage?: string };
  };
  // tool_execution_start | tool_execution_update | tool_execution_end
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
};
type PiAgentSession = {
  agent: { state: { systemPrompt?: string } };
  prompt(message: string, options?: Record<string, unknown>): Promise<void>;
  subscribe(handler: (event: PiAgentSessionEvent) => void): () => void;
  dispose(): void;
};

/** Max characters retained for tool input/output previews on the wire. */
const TOOL_PREVIEW_MAX = 500;

function truncatePreview(value: unknown, maxLen = TOOL_PREVIEW_MAX): string | undefined {
  if (value === undefined || value === null) return undefined;
  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '…';
}

interface PiSdkModule {
  createAgentSession: (options: Record<string, unknown>) => Promise<{ session: PiAgentSession }>;
  SessionManager: { inMemory(): unknown };
  AuthStorage: { inMemory(): PiAuthStorage };
  ModelRegistry: { inMemory(auth: PiAuthStorage): PiModelRegistry };
  createReadToolDefinition: (cwd: string) => unknown;
  createBashToolDefinition: (cwd: string) => unknown;
  createGrepToolDefinition: (cwd: string) => unknown;
  createFindToolDefinition: (cwd: string) => unknown;
  createLsToolDefinition: (cwd: string) => unknown;
}

interface PiCachedSdk {
  sdk: PiSdkModule;
  auth: PiAuthStorage;
  registry: PiModelRegistry;
  /** Providers that have at least one credential loaded from env */
  availableProviders: Set<string>;
}

let cached: PiCachedSdk | null = null;

async function loadPiSdk(): Promise<PiCachedSdk> {
  if (cached) return cached;

  const sdk = (await import(
    /* @vite-ignore */ '@mariozechner/pi-coding-agent'
  )) as unknown as PiSdkModule;

  const auth = sdk.AuthStorage.inMemory();
  const availableProviders = loadCredentialsFromEnv(auth);
  const registry = sdk.ModelRegistry.inMemory(auth);

  cached = { sdk, auth, registry, availableProviders };
  logger.info('PiBackend SDK loaded');
  return cached;
}

function loadCredentialsFromEnv(auth: PiAuthStorage): Set<string> {
  const availableProviders = new Set<string>();
  const sources: Array<{ provider: string; envVars: string[] }> = [
    { provider: 'google', envVars: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'] },
    { provider: 'opencode-go', envVars: ['OPENCODE_API_KEY'] },
  ];

  for (const { provider, envVars } of sources) {
    const key = envVars.map((v) => process.env[v]).find((v) => !!v);
    if (key) {
      auth.set(provider, { type: 'api_key', key });
      availableProviders.add(provider);
      logger.debug(`PiBackend: loaded ${provider} credential from env`);
    }
  }

  return availableProviders;
}

function resolveModel(registry: PiModelRegistry, spec?: string): PiModel | undefined {
  if (!spec) return undefined;
  const bareId = spec.startsWith('pi/') ? spec.slice(3) : spec;

  // "provider/modelId" form
  if (bareId.includes('/')) {
    const [provider, ...rest] = bareId.split('/');
    const id = rest.join('/');
    const direct = registry.find(provider, id);
    if (direct) return direct;
  }

  // Bare id — scan the catalog
  const all = registry.getAll();
  return all.find((m) => m.id === bareId || m.name === bareId);
}

export class PiBackend implements AiBackend {
  readonly name = 'pi';

  async prompt(message: string, options: PromptOptions = {}): Promise<string> {
    const { sdk, auth, registry } = await loadPiSdk();
    const cwd = process.cwd();

    const tools = [
      sdk.createReadToolDefinition(cwd),
      sdk.createBashToolDefinition(cwd),
      sdk.createGrepToolDefinition(cwd),
      sdk.createFindToolDefinition(cwd),
      sdk.createLsToolDefinition(cwd),
    ] as Array<{ name: string }>;

    const model = resolveModel(registry, options.model);
    if (options.model && !model) {
      logger.warn(`PiBackend: could not resolve model "${options.model}", falling back to SDK default`);
    }

    const { session } = await sdk.createAgentSession({
      cwd,
      authStorage: auth,
      modelRegistry: registry,
      ...(model ? { model } : {}),
      customTools: tools,
      // Pi SDK requires a string[] allowlist; passing tool objects silently disables them.
      tools: tools.map((t) => t.name),
      sessionManager: sdk.SessionManager.inMemory(),
    });

    let assistantText = '';
    let lastError = '';
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));

    const unsub = session.subscribe((event) => {
      if (event.type === 'message_end' && event.message?.role === 'assistant') {
        const msg = event.message;
        if (msg.stopReason === 'error' && msg.errorMessage) {
          lastError = msg.errorMessage;
        }
        const c = msg.content;
        if (typeof c === 'string') {
          assistantText = c;
        } else if (Array.isArray(c)) {
          assistantText = c
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text!)
            .join('');
        }
      }
      if (event.type === 'agent_end') {
        resolveDone();
      }
    });

    try {
      await session.prompt(message);
      await done;
      if (!assistantText.trim() && lastError) {
        throw new Error(lastError);
      }
      return assistantText.trim();
    } finally {
      unsub();
      session.dispose();
    }
  }

  async *promptStream(message: string, options: PromptOptions = {}): AsyncGenerator<StreamEvent> {
    const { sdk, auth, registry } = await loadPiSdk();
    const cwd = process.cwd();

    const tools = [
      sdk.createReadToolDefinition(cwd),
      sdk.createBashToolDefinition(cwd),
      sdk.createGrepToolDefinition(cwd),
      sdk.createFindToolDefinition(cwd),
      sdk.createLsToolDefinition(cwd),
    ] as Array<{ name: string }>;

    const model = resolveModel(registry, options.model);
    if (options.model && !model) {
      logger.warn(`PiBackend: could not resolve model "${options.model}", falling back to SDK default`);
    }

    const { session } = await sdk.createAgentSession({
      cwd,
      authStorage: auth,
      modelRegistry: registry,
      ...(model ? { model } : {}),
      customTools: tools,
      tools: tools.map((t) => t.name),
      sessionManager: sdk.SessionManager.inMemory(),
    });

    // ── Bridge: subscribe-callback push → async-generator pull ─────────────
    const queue: StreamEvent[] = [];
    let waker: (() => void) | null = null;
    let finished = false;
    /** Tracked for tail-emit at agent_end so consumers see at most one terminal `error`. */
    let pendingError: string | null = null;

    const wake = () => {
      const r = waker;
      waker = null;
      r?.();
    };
    const push = (e: StreamEvent) => {
      queue.push(e);
      wake();
    };
    const finish = () => {
      finished = true;
      wake();
    };

    const unsub = session.subscribe((event) => {
      switch (event.type) {
        case 'agent_start':
          push({ type: 'status', phase: 'starting' });
          break;

        case 'message_start':
          // First assistant message → useful "the model is now reasoning" signal.
          if (event.message?.role === 'assistant') {
            push({ type: 'status', phase: 'analyzing' });
          }
          break;

        case 'message_update': {
          const ame = event.assistantMessageEvent;
          if (!ame) break;
          if (ame.type === 'text_delta' && typeof ame.delta === 'string' && ame.delta.length > 0) {
            push({ type: 'text', content: ame.delta, delta: true });
          } else if (ame.type === 'thinking_delta' && typeof ame.delta === 'string' && ame.delta.length > 0) {
            push({ type: 'thinking', content: ame.delta, delta: true });
          } else if (ame.type === 'error') {
            pendingError = ame.error?.errorMessage || pendingError || 'Pi assistant message error';
          }
          break;
        }

        case 'message_end':
          if (
            event.message?.role === 'assistant' &&
            event.message?.stopReason === 'error' &&
            event.message?.errorMessage
          ) {
            pendingError = event.message.errorMessage;
          }
          break;

        case 'tool_execution_start':
          if (event.toolCallId && event.toolName) {
            push({
              type: 'tool_use',
              toolName: event.toolName,
              callId: event.toolCallId,
              input: truncatePreview(event.args),
            });
          }
          break;

        case 'tool_execution_end':
          if (event.toolCallId) {
            push({
              type: 'tool_result',
              callId: event.toolCallId,
              ok: !event.isError,
              preview: truncatePreview(event.result),
            });
          }
          break;

        case 'agent_end':
          if (pendingError) {
            push({ type: 'error', error: pendingError });
          } else {
            push({ type: 'done' });
          }
          finish();
          break;
      }
    });

    // Kick off the run; the agent_end event will resolve our loop. If `prompt()`
    // itself rejects (network/SDK fault before agent_end), surface it as a terminal
    // `error` and finish the queue.
    session.prompt(message).catch((err) => {
      logger.error('PiBackend.promptStream: session.prompt rejected', err);
      push({ type: 'error', error: err instanceof Error ? err.message : String(err) });
      finish();
    });

    try {
      while (true) {
        if (queue.length === 0) {
          if (finished) break;
          await new Promise<void>((r) => {
            waker = r;
          });
          continue;
        }
        const ev = queue.shift()!;
        yield ev;
        if (ev.type === 'done' || ev.type === 'error') break;
      }
    } finally {
      unsub();
      session.dispose();
    }
  }

  async listModels(): Promise<ModelOption[]> {
    const { registry, availableProviders } = await loadPiSdk();
    return registry
      .getAll()
      .filter((m) => availableProviders.has(m.provider))
      .map((m) => ({
        id: `${m.provider}/${m.id}`,
        name: m.name ?? m.id,
        provider: m.provider,
        providerId: m.provider,
        modelId: m.id,
        variants: [],
      }));
  }
}
