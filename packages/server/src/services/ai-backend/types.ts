/**
 * AiBackend Interface
 *
 * Provider-agnostic contract for AI backends used by clm's review services.
 * All backends (OpenCode, Pi, ...) implement this interface so the four
 * review services (ai-review, grouping)
 * never branch on provider.
 */

/**
 * Reasoning / "thinking" effort tier for models that support it.
 *
 * Mirrors `ThinkingLevel` from `@mariozechner/pi-agent-core`. Backends that
 * don't support reasoning effort silently ignore this field. The Pi backend
 * automatically clamps the value to the model's capabilities.
 */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface PromptOptions {
  /** Provider-qualified model id, e.g. "google/gemini-3-flash-preview". */
  model?: string;
  /** Optional model variant (used by OpenCode; ignored by other backends). */
  variant?: string;
  /** Reasoning effort tier (used by Pi; ignored by backends without reasoning support). */
  thinkingLevel?: ThinkingLevel;
}

/**
 * Phases reported via {@link StreamStatusEvent}.
 *
 * - `starting`     – generator has started; no work yet
 * - `fetching_pr`  – pulling PR metadata / diff
 * - `analyzing`    – model is reasoning over the PR
 * - `finalizing`   – assembling / parsing the final structured result
 */
export type StreamStatusPhase = 'starting' | 'fetching_pr' | 'analyzing' | 'finalizing';

/** Coarse-grained progress signal for UI status banners. */
export interface StreamStatusEvent {
  type: 'status';
  phase: StreamStatusPhase;
  message?: string;
}

/** Reasoning / scratchpad text from the model. Set `delta: true` for incremental chunks. */
export interface StreamThinkingEvent {
  type: 'thinking';
  content: string;
  delta?: boolean;
}

/** Agent invoked a tool. `callId` correlates with the matching {@link StreamToolResultEvent}. */
export interface StreamToolUseEvent {
  type: 'tool_use';
  toolName: string;
  callId: string;
  /** May be truncated by the backend to keep SSE payloads small. */
  input?: unknown;
}

/** Result of a previous tool call, identified by `callId`. */
export interface StreamToolResultEvent {
  type: 'tool_result';
  callId: string;
  ok: boolean;
  /** Truncated preview of the tool output (≤500 chars by convention). */
  preview?: string;
}

/** Visible assistant text. Set `delta: true` for incremental chunks. */
export interface StreamTextEvent {
  type: 'text';
  content: string;
  delta?: boolean;
}

/** Token accounting; emitted at most once per stream, near the end. */
export interface StreamTokenUsageEvent {
  type: 'token_usage';
  inputTokens?: number;
  outputTokens?: number;
}

/** Stream completed successfully. Always the last event when no error occurred. */
export interface StreamDoneEvent {
  type: 'done';
}

/** Stream terminated with an error. Always the last event when an error occurred. */
export interface StreamErrorEvent {
  type: 'error';
  error: string;
}

/**
 * Discriminated union of every event a backend may emit through {@link AiBackend.promptStream}.
 *
 * The union is additive: existing producers that only yield `text`, `done`, or `error`
 * remain valid, and existing consumers that switch on `event.type` keep narrowing correctly.
 */
export type StreamEvent =
  | StreamStatusEvent
  | StreamThinkingEvent
  | StreamToolUseEvent
  | StreamToolResultEvent
  | StreamTextEvent
  | StreamTokenUsageEvent
  | StreamDoneEvent
  | StreamErrorEvent;

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  modelId: string;
  variants: string[];
}

export interface AiBackend {
  /** Backend identifier, e.g. 'opencode' | 'pi'. */
  readonly name: string;

  /** Send a prompt and resolve with the full response text. */
  prompt(message: string, options?: PromptOptions): Promise<string>;

  /** Send a prompt and stream response chunks. */
  promptStream(message: string, options?: PromptOptions): AsyncGenerator<StreamEvent>;

  /** Enumerate models the backend can serve (for the UI selector). */
  listModels(): Promise<ModelOption[]>;
}
