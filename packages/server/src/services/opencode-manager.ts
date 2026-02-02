import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/client';
import type { Subprocess } from 'bun';

const OPENCODE_BINARY = process.env.OPENCODE_BINARY || 'opencode';
const OPENCODE_PORT = parseInt(process.env.OPENCODE_PORT || '4096', 10);
const OPENCODE_HOSTNAME = process.env.OPENCODE_HOSTNAME || '127.0.0.1';
const HEALTH_CHECK_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_INTERVAL_MS = 500;

function parseModelString(model: string): { providerID: string; modelID: string } {
  const [providerID, ...rest] = model.split('/');
  const modelID = rest.join('/') || providerID;
  return { providerID: providerID || 'anthropic', modelID };
}

export interface PromptOptions {
  model?: string;
  sessionId?: string;
}

export interface StreamEvent {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
}

class OpenCodeManager {
  private process: Subprocess | null = null;
  private client: OpencodeClient | null = null;
  private baseUrl: string;
  private ready = false;
  private startPromise: Promise<void> | null = null;

  constructor() {
    this.baseUrl = `http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}`;
  }

  async start(): Promise<void> {
    if (this.ready) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this._start();
    return this.startPromise;
  }

  private async _start(): Promise<void> {
    console.log(`[opencode] Starting server on ${this.baseUrl}...`);

    this.process = Bun.spawn([
      OPENCODE_BINARY,
      'serve',
      '--port', String(OPENCODE_PORT),
      '--hostname', OPENCODE_HOSTNAME,
    ], {
      stdin: null,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    this._forwardLogs();

    await this._waitForHealth();

    this.client = createOpencodeClient({ baseUrl: this.baseUrl });
    this.ready = true;
    console.log('[opencode] Server ready');
  }

  private async _forwardLogs(): Promise<void> {
    if (!this.process) return;

    const stdout = this.process.stdout;
    const stderr = this.process.stderr;

    if (stdout && typeof stdout !== 'number') {
      (async () => {
        const reader = stdout.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          console.log(`[opencode] ${decoder.decode(value).trim()}`);
        }
      })();
    }

    if (stderr && typeof stderr !== 'number') {
      (async () => {
        const reader = stderr.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          console.error(`[opencode] ${decoder.decode(value).trim()}`);
        }
      })();
    }
  }

  private async _waitForHealth(): Promise<void> {
    const healthUrl = `${this.baseUrl}/global/health`;
    const startTime = Date.now();

    while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
      try {
        const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json() as { healthy?: boolean };
          if (data.healthy) return;
        }
      } catch {
        // Connection refused - server not ready yet
      }
      await Bun.sleep(HEALTH_CHECK_INTERVAL_MS);
    }

    throw new Error('OpenCode server failed to become healthy');
  }

  isReady(): boolean {
    return this.ready;
  }

  getClient() {
    if (!this.client) {
      throw new Error('OpenCode client not initialized. Call start() first.');
    }
    return this.client;
  }

  /**
   * Send a prompt and wait for full response (sync)
   */
  async prompt(message: string, options: PromptOptions = {}): Promise<string> {
    await this.start();
    const client = this.getClient();

    // Create or get session
    const sessionResult = await client.session.create({});
    if (sessionResult.error || !sessionResult.data) {
      throw new Error('Failed to create session');
    }
    const sessionId = sessionResult.data.id;

    // Build model config if provided
    const modelConfig = options.model ? parseModelString(options.model) : undefined;

    // Send prompt and wait for response
    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: message }],
        ...(modelConfig && { model: modelConfig }),
      },
    });

    if (response.error || !response.data) {
      throw new Error('Failed to get response');
    }

    // Extract text from response parts
    const textParts = response.data.parts
      ?.filter((p) => p.type === 'text' && 'text' in p)
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('') || '';

    return textParts;
  }

  /**
   * Send a prompt and stream response chunks (async generator)
   */
  async *promptStream(message: string, options: PromptOptions = {}): AsyncGenerator<StreamEvent> {
    await this.start();
    const client = this.getClient();

    // Create session
    const sessionResult = await client.session.create({});
    if (sessionResult.error || !sessionResult.data) {
      throw new Error('Failed to create session');
    }
    const sessionId = sessionResult.data.id;

    // Subscribe to events BEFORE sending prompt
    const eventsResponse = await fetch(`${this.baseUrl}/event`, {
      headers: { 'Accept': 'text/event-stream' },
    });

    if (!eventsResponse.ok || !eventsResponse.body) {
      throw new Error('Failed to subscribe to events');
    }

    // Send prompt async (fire and forget)
    const promptBody = {
      parts: [{ type: 'text' as const, text: message }],
      ...(options.model && { model: options.model }),
    };

    fetch(`${this.baseUrl}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promptBody),
    }).catch(err => {
      console.error('[opencode] Failed to send async prompt:', err);
    });

    // Stream SSE events
    const reader = eventsResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;

    try {
      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) {
          done = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (!data || data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              
              // Handle different event types
              if (event.type === 'message.part.updated' || event.type === 'assistant.message.part') {
                const text = event.properties?.part?.text || event.properties?.text;
                if (text) {
                  yield { type: 'text', content: text };
                }
              } else if (event.type === 'session.completed' || event.type === 'assistant.message.completed') {
                yield { type: 'done' };
                done = true;
                break;
              } else if (event.type === 'error') {
                yield { type: 'error', error: event.properties?.message || 'Unknown error' };
                done = true;
                break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      eventsResponse.body.cancel().catch(() => {});
    }
  }

  async shutdown(): Promise<void> {
    console.log('[opencode] Shutting down...');

    if (this.process) {
      this.process.kill();
      await this.process.exited;
      this.process = null;
    }

    this.client = null;
    this.ready = false;
    this.startPromise = null;
    console.log('[opencode] Shutdown complete');
  }
}

// Singleton instance
export const opencodeManager = new OpenCodeManager();

// Graceful shutdown on process exit
process.on('SIGTERM', () => opencodeManager.shutdown());
process.on('SIGINT', () => opencodeManager.shutdown());
