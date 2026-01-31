import { CommentForm, type CommentFormProps } from "./comment-form"
import { InlineCommentThread, type InlineCommentThreadProps } from "./inline-comment-thread"

// ============================================================================
// Exports
// ============================================================================

export const CommentThread = {
  Inline: InlineCommentThread,
  Form: CommentForm,
}

// Re-export types
export type {
  CommentFormProps,
  InlineCommentThreadProps,
}
