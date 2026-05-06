/**
 * AiBackend Interface
 *
 * Provider-agnostic contract for AI backends used by clm's review services.
 * All backends (OpenCode, Pi, ...) implement this interface so the four
 * review services (ai-review, grouping)
 * never branch on provider.
 */

export interface PromptOptions {
  /** Provider-qualified model id, e.g. "google/gemini-3-flash-preview". */
  model?: string;
  /** Optional model variant (used by OpenCode; ignored by other backends). */
  variant?: string;
}

export interface StreamEvent {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
}

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
