import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/client';
import { logger } from '../lib/logger.js';

const OPENCODE_URL = process.env.OPENCODE_URL || 'http://127.0.0.1:4096';

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

class OpenCodeClient {
  private client: OpencodeClient;
  private baseUrl: string;

  constructor() {
    this.baseUrl = OPENCODE_URL;
    this.client = createOpencodeClient({ baseUrl: this.baseUrl });
    logger.info(`OpenCode client initialized: ${this.baseUrl}`);
  }

  getClient(): OpencodeClient {
    return this.client;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Send a prompt and wait for full response (sync)
   */
  async prompt(message: string, options: PromptOptions = {}): Promise<string> {
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
      logger.error('Failed to send async prompt', err);
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
}

// Singleton instance
export const opencodeClient = new OpenCodeClient();
