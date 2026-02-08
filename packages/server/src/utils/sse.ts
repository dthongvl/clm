import { streamSSE } from 'hono/streaming';
import { opencodeClient } from '../services/opencode-client.js';
import { logger } from '../lib/logger.js';
import type { Context } from 'hono';

export function streamOpencodeResponse(c: Context, message: string) {
  return streamSSE(c, async (stream) => {
    try {
      for await (const event of opencodeClient.promptStream(message)) {
        if (event.type === 'text' && event.content) {
          await stream.writeSSE({
            event: 'message',
            data: JSON.stringify({ text: event.content }),
          });
        } else if (event.type === 'done') {
          await stream.writeSSE({ event: 'done', data: '' });
          break;
        } else if (event.type === 'error') {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ error: event.error }),
          });
          break;
        }
      }
    } catch (error) {
      logger.error('Stream error', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: (error as Error).message }),
      });
    }
  });
}
