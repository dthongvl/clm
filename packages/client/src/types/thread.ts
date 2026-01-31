import type { Severity } from "./review"

export type { Severity }

/**
 * Author of a thread message.
 */
export interface ThreadAuthor {
  /** Unique identifier for the author */
  id: string
  /** Display name */
  name: string
  /** Author type - human or AI */
  type: "human" | "ai"
  /** Optional avatar URL */
  avatarUrl?: string
}

/**
 * A single message in a thread.
 */
export interface ThreadMessage {
  /** Unique identifier for the message */
  id: string
  /** The message content (supports markdown) */
  content: string
  /** Author of the message */
  author: ThreadAuthor
  /** When the message was created */
  createdAt: Date
  /** Optional severity level (for AI review items) */
  severity?: Severity
  /** Whether this message is currently being streamed */
  isStreaming?: boolean
}

/**
 * Thread variant determines the behavior and appearance.
 * 
 * - `github`: Human-human code review synced with GitHub
 * - `ai-discussion`: Local human-AI discussion about code
 * - `ai-review`: AI-initiated review with follow-up discussion
 */
export type ThreadVariant = "github" | "ai-discussion" | "ai-review"

/**
 * Location context for a thread attached to code.
 */
export interface ThreadCodeLocation {
  /** File path the thread is attached to */
  filePath: string
  /** Line number in the file */
  lineNumber: number
  /** Which side of the diff (for split view) */
  side?: "additions" | "deletions"
}

/**
 * Full thread data structure.
 */
export interface Thread {
  /** Unique identifier for the thread */
  id: string
  /** Thread variant/type */
  variant: ThreadVariant
  /** Messages in the thread */
  messages: ThreadMessage[]
  /** Code location (if attached to code) */
  codeLocation?: ThreadCodeLocation
  /** Whether the thread is resolved */
  resolved?: boolean
  /** When the thread was created */
  createdAt: Date
  /** When the thread was last updated */
  updatedAt: Date
}
