import { streamSSE } from 'hono/streaming';
import { logger } from '../lib/logger.js';
import type { Context } from 'hono';

/** Frequency of SSE keepalive comments. Keeps reverse-proxy idle connections alive. */
const KEEPALIVE_INTERVAL_MS = 15_000;

/**
 * Minimal contract every event in an `AiBackend.promptStream`-derived stream
 * satisfies: a discriminator string under `type`. The route helper reads only
 * this field; everything else is JSON-serialized into the SSE `data:` payload.
 */
interface TypedEvent {
  type: string;
}

/**
 * Stream an async-generator of typed events to the client over SSE.
 *
 * Each event is sent as a `event: <type>` + `data: <json>` frame. A
 * `:keepalive` comment is sent every {@link KEEPALIVE_INTERVAL_MS} so reverse
 * proxies (Cloudflare, nginx) don't drop the connection during long thinking
 * phases. When the client disconnects, the generator is cancelled via
 * `iterator.return()`, which propagates through the service-layer generators
 * to `session.dispose()` in the Pi backend.
 *
 * Terminal events (`done`, `error`) close the stream after they're written.
 *
 * @param c          Hono context (the SSE response is taken over from here).
 * @param generator  Factory invoked once the SSE channel is open. Must return
 *                   a fresh `AsyncGenerator` each call (so retries don't reuse
 *                   an exhausted iterator).
 */
export function streamAiResponse<E extends TypedEvent>(
  c: Context,
  generator: () => AsyncGenerator<E>,
): Response {
  return streamSSE(c, async (stream) => {
    const iterator = generator();

    // Cancel the generator when the client disconnects so server-side resources
    // (Pi `session.dispose()`, Opencode SSE reader, etc.) are released promptly.
    let cancelled = false;
    stream.onAbort(async () => {
      cancelled = true;
      await iterator.return?.(undefined as never).catch(() => {});
    });

    const keepalive = setInterval(() => {
      if (stream.closed || stream.aborted) return;
      // Raw write — SSE comment lines start with ":" and are ignored by clients.
      stream.write(`: keepalive\n\n`).catch(() => {});
    }, KEEPALIVE_INTERVAL_MS);

    try {
      for await (const event of iterator) {
        if (cancelled || stream.closed || stream.aborted) break;
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
        if (event.type === 'done' || event.type === 'error') break;
      }
    } catch (error) {
      logger.error('SSE stream failed', error);
      if (!stream.closed && !stream.aborted) {
        await stream
          .writeSSE({
            event: 'error',
            data: JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : String(error),
            }),
          })
          .catch(() => {});
      }
    } finally {
      clearInterval(keepalive);
    }
  });
}
