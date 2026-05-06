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
type PiAgentSessionEvent = {
  type: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
    stopReason?: string;
    errorMessage?: string;
  };
};
type PiAgentSession = {
  agent: { state: { systemPrompt?: string } };
  prompt(message: string, options?: Record<string, unknown>): Promise<void>;
  subscribe(handler: (event: PiAgentSessionEvent) => void): () => void;
  dispose(): void;
};

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
    // Pi SDK emits at message-level rather than token-level; a single yield
    // before `done` matches the granularity of the underlying events.
    try {
      const text = await this.prompt(message, options);
      if (text) yield { type: 'text', content: text };
      yield { type: 'done' };
    } catch (error) {
      yield { type: 'error', error: error instanceof Error ? error.message : String(error) };
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
