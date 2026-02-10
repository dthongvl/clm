import { memo } from "react"
import type { DiffLineAnnotation, AnnotationSide } from "@pierre/diffs/react"
import type { ReviewComment } from "@/types/review"
import { CommentThread } from "@/components/comment-thread"
import { CommentForm } from "@/components/comment-thread/comment-form"
import type { AnnotationMetadata } from "./diff-viewer"

interface AnnotationRendererProps {
  annotation: DiffLineAnnotation<AnnotationMetadata>
  submittingDrafts: Set<string>
  submittingReplies: Set<string>
  onSubmitDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
    content: string
  ) => Promise<void>
  onCancelDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number
  ) => void
  onSubmitReply?: (commentId: string, content: string) => Promise<void>
  onEditDraft?: (commentId: string, content: string) => Promise<void>
  onDeleteDraft?: (commentId: string) => Promise<void>
  isDraftActionLoading?: boolean
  /** Callback to convert an AI review item to a draft comment */
  onConvertAIToDraft?: (itemId: string) => Promise<void>
  /** Set of AI item IDs currently being converted */
  convertingAIItemIds?: Set<string>
}

export const AnnotationRenderer = memo(function AnnotationRenderer({
  annotation,
  submittingDrafts,
  submittingReplies,
  onSubmitDraft,
  onCancelDraft,
  onSubmitReply,
  onEditDraft,
  onDeleteDraft,
  isDraftActionLoading,
  onConvertAIToDraft,
  convertingAIItemIds,
}: AnnotationRendererProps) {
  const meta = annotation.metadata
  if (!meta) return null

  if (meta.type === "draft") {
    const draftId = `draft-${meta.draft.filePath}-${meta.draft.side}-${meta.draft.lineNumber}`
    const isSubmitting = submittingDrafts.has(draftId)

    return (
      <CommentForm
        variant="inline"
        size="sm"
        autoFocus
        showKeyboardHints
        placeholder="Leave a comment..."
        onSubmit={(content) =>
          onSubmitDraft(
            meta.draft.filePath,
            meta.draft.side,
            meta.draft.lineNumber,
            content
          )
        }
        onCancel={() =>
          onCancelDraft(
            meta.draft.filePath,
            meta.draft.side,
            meta.draft.lineNumber
          )
        }
        isLoading={isSubmitting}
      />
    )
  }

  if (meta.type === "ai-review") {
    const aiComment: ReviewComment = {
      id: meta.item.id,
      filePath: meta.item.filePath,
      lineNumber: meta.item.lineNumber,
      side: "additions",
      content: meta.item.suggestion
        ? `${meta.item.message}\n\n**Suggestion:** ${meta.item.suggestion}`
        : meta.item.message,
      author: { type: "ai", name: "AI Review" },
      severity: meta.item.severity,
      createdAt: new Date(),
      replies: [],
    }

    const isConverting = convertingAIItemIds?.has(meta.item.id) ?? false

    return (
      <CommentThread.Inline
        comment={aiComment}
        lineNumber={annotation.lineNumber}
        onConvertToDraft={
          onConvertAIToDraft
            ? () => onConvertAIToDraft(meta.item.id)
            : undefined
        }
        isConvertingToDraft={isConverting}
      />
    )
  }

  return (
    <CommentThread.Inline
      comment={meta.comment}
      lineNumber={annotation.lineNumber}
      onReplySubmit={onSubmitReply}
      isSubmittingReply={submittingReplies.has(meta.comment.id)}
      onEditDraft={onEditDraft}
      onDeleteDraft={onDeleteDraft}
      isDraftActionLoading={isDraftActionLoading}
    />
  )
})
