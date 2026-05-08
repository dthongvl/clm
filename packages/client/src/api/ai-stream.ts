import { API_BASE, type ApiError } from './client';
import type { AIReviewPRResponse, ServerChangeGroup } from './ai';

/**
 * Mirror of the server's `StreamEvent` discriminated union (see
 * `packages/server/src/services/ai-backend/types.ts`). Keep these in sync.
 */
export type StreamStatusPhase = 'starting' | 'fetching_pr' | 'analyzing' | 'finalizing';

export interface StreamStatusEvent {
  type: 'status';
  phase: StreamStatusPhase;
  message?: string;
}

export interface StreamThinkingEvent {
  type: 'thinking';
  content: string;
  delta?: boolean;
}

export interface StreamToolUseEvent {
  type: 'tool_use';
  toolName: string;
  callId: string;
  input?: unknown;
}

export interface StreamToolResultEvent {
  type: 'tool_result';
  callId: string;
  ok: boolean;
  preview?: string;
}

export interface StreamTextEvent {
  type: 'text';
  content: string;
  delta?: boolean;
}

export interface StreamTokenUsageEvent {
  type: 'token_usage';
  inputTokens?: number;
  outputTokens?: number;
}

export interface StreamDoneEvent {
  type: 'done';
}

export interface StreamErrorEvent {
  type: 'error';
  error: string;
}

export type StreamEvent =
  | StreamStatusEvent
  | StreamThinkingEvent
  | StreamToolUseEvent
  | StreamToolResultEvent
  | StreamTextEvent
  | StreamTokenUsageEvent
  | StreamDoneEvent
  | StreamErrorEvent;

export interface ReviewResultEvent {
  type: 'result';
  result: AIReviewPRResponse;
}

export type ReviewStreamEvent = StreamEvent | ReviewResultEvent;

export interface GroupingResultEvent {
  type: 'result';
  result: { groups: ServerChangeGroup[] };
}

export type GroupingStreamEvent = StreamEvent | GroupingResultEvent;

export interface StreamRequestBody {
  additionalContext?: string;
}

interface StreamOptions {
  signal?: AbortSignal;
}

const SSE_FRAME_DELIMITER = /\r?\n\r?\n/;

/**
 * Parse a single SSE frame ("event: foo\ndata: {...}") into a typed event.
 * Returns `null` for comment-only frames (`:keepalive`) or frames without a
 * `data:` line.
 */
function parseFrame<E extends { type: string }>(frame: string): E | null {
  const lines = frame.split(/\r?\n/);
  let dataPayload = '';
  let hasData = false;

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    // SSE spec: a single space following the colon is part of the framing, strip it.
    let value = line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'data') {
      dataPayload = dataPayload ? `${dataPayload}\n${value}` : value;
      hasData = true;
    }
  }

  if (!hasData) return null;
  try {
    return JSON.parse(dataPayload) as E;
  } catch {
    return null;
  }
}

async function* readSSE<E extends { type: string }>(
  response: Response,
): AsyncGenerator<E> {
  if (!response.body) {
    throw new Error('Response has no body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Drain every complete frame
      // currently in the buffer; keep the trailing partial frame for next read.
      while (true) {
        const match = SSE_FRAME_DELIMITER.exec(buffer);
        if (!match) break;
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parseFrame<E>(frame);
        if (event) yield event;
      }
    }

    // Flush any final frame that lacked a trailing blank line.
    const tail = buffer + decoder.decode();
    if (tail.trim()) {
      const event = parseFrame<E>(tail);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

async function openStream(
  endpoint: string,
  body: StreamRequestBody,
  options: StreamOptions = {},
): Promise<Response> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || 'Stream request failed') as ApiError;
    error.status = response.status;
    error.details = errorData.details;
    throw error;
  }

  return response;
}

/**
 * Open the AI review SSE stream and yield typed events as they arrive.
 *
 * The generator terminates when the server emits `done` or `error`, when the
 * underlying `fetch` is aborted via `options.signal`, or when the response
 * body closes. Callers are responsible for handling `AbortError` from
 * `signal.abort()`.
 */
export async function* streamAiReview(
  body: StreamRequestBody = {},
  options: StreamOptions = {},
): AsyncGenerator<ReviewStreamEvent> {
  const response = await openStream('/ai/review/pr/stream', body, options);
  for await (const event of readSSE<ReviewStreamEvent>(response)) {
    yield event;
    if (event.type === 'done' || event.type === 'error') return;
  }
}

/**
 * Open the AI grouping SSE stream and yield typed events as they arrive.
 */
export async function* streamAiGrouping(
  body: StreamRequestBody = {},
  options: StreamOptions = {},
): AsyncGenerator<GroupingStreamEvent> {
  const response = await openStream('/ai/grouping/stream', body, options);
  for await (const event of readSSE<GroupingStreamEvent>(response)) {
    yield event;
    if (event.type === 'done' || event.type === 'error') return;
  }
}
