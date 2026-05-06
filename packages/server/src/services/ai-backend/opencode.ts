/**
 * OpencodeBackend
 *
 * AiBackend implementation backed by an external `opencode serve` HTTP server.
 * Mirrors the behavior of the previous opencode-client.ts singleton.
 */

import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/client';
import { logger } from '../../lib/logger.js';
import type { AiBackend, ModelOption, PromptOptions, StreamEvent } from './types.js';

function parseModelString(model: string, variant?: string): { providerID: string; modelID: string; variant?: string } {
  const [providerID, ...rest] = model.split('/');
  const modelID = rest.join('/') || providerID;
  return { providerID: providerID || 'anthropic', modelID, ...(variant && { variant }) };
}

export class OpencodeBackend implements AiBackend {
  readonly name = 'opencode';

  private readonly client: OpencodeClient;
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096';
    this.client = createOpencodeClient({ baseUrl: this.baseUrl });
    logger.info(`OpencodeBackend initialized: ${this.baseUrl}`);
  }

  async prompt(message: string, options: PromptOptions = {}): Promise<string> {
    const sessionResult = await this.client.session.create({});
    if (sessionResult.error || !sessionResult.data) {
      throw new Error('Failed to create session');
    }
    const sessionId = sessionResult.data.id;

    const modelConfig = options.model ? parseModelString(options.model, options.variant) : undefined;
    if (modelConfig?.variant) {
      logger.debug(`Using model variant: ${modelConfig.providerID}/${modelConfig.modelID} [${modelConfig.variant}]`);
    }

    const response = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: message }],
        ...(modelConfig && { model: modelConfig }),
      },
    });

    if (response.error || !response.data) {
      throw new Error('Failed to get response');
    }

    return (
      response.data.parts
        ?.filter((p) => p.type === 'text' && 'text' in p)
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('') || ''
    );
  }

  async *promptStream(message: string, options: PromptOptions = {}): AsyncGenerator<StreamEvent> {
    const sessionResult = await this.client.session.create({});
    if (sessionResult.error || !sessionResult.data) {
      throw new Error('Failed to create session');
    }
    const sessionId = sessionResult.data.id;

    const eventsResponse = await fetch(`${this.baseUrl}/event`, {
      headers: { Accept: 'text/event-stream' },
    });

    if (!eventsResponse.ok || !eventsResponse.body) {
      throw new Error('Failed to subscribe to events');
    }

    const modelConfig = options.model ? parseModelString(options.model, options.variant) : undefined;
    if (modelConfig?.variant) {
      logger.debug(`Using model variant (stream): ${modelConfig.providerID}/${modelConfig.modelID} [${modelConfig.variant}]`);
    }

    const promptBody = {
      parts: [{ type: 'text' as const, text: message }],
      ...(modelConfig && { model: modelConfig }),
    };

    fetch(`${this.baseUrl}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promptBody),
    }).catch((err) => {
      logger.error('Failed to send async prompt', err);
      logger.debug(`Async prompt context: sessionId=${sessionId}, baseUrl=${this.baseUrl}`);
    });

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
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (!data || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            const eventSessionId = event.properties?.sessionID || event.properties?.sessionId;
            if (eventSessionId && eventSessionId !== sessionId) continue;

            if (event.type === 'message.part.updated' || event.type === 'assistant.message.part') {
              const text = event.properties?.part?.text || event.properties?.text;
              if (text) yield { type: 'text', content: text };
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
            logger.debug(`Skipping invalid SSE JSON: ${data.slice(0, 100)}...`);
          }
        }
      }
    } finally {
      reader.releaseLock();
      eventsResponse.body.cancel().catch(() => {});
    }
  }

  async listModels(): Promise<ModelOption[]> {
    const result = await this.client.provider.list({});
    if (result.error || !result.data) {
      throw new Error('Failed to fetch providers');
    }

    const { all, connected } = result.data;
    const connectedSet = new Set(connected);
    const models: ModelOption[] = [];

    for (const provider of all) {
      if (!connectedSet.has(provider.id)) continue;
      for (const [modelId, model] of Object.entries(provider.models)) {
        const variants = Object.keys((model as { variants?: Record<string, unknown> }).variants ?? {});
        models.push({
          id: `${provider.id}/${modelId}`,
          name: model.name,
          provider: provider.name,
          providerId: provider.id,
          modelId,
          variants,
        });
      }
    }

    return models;
  }
}
