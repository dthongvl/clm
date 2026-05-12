import { memo } from "react"
import type { DiffLineAnnotation, AnnotationSide } from "@pierre/diffs/react"
import type { ReviewComment } from "@/types/review"
import type { NotebookJudgmentThread } from "@/types/review-guide"
import { CommentThread } from "@/components/comment-thread"
import { CommentForm } from "@/components/comment-thread/comment-form"
import type {
  AnnotationMetadata,
  NotebookJudgmentThreadOps,
} from "./diff-viewer"

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
  onEditReply?: (commentId: string, content: string) => Promise<void>
  onDeleteReply?: (commentId: string) => Promise<void>
  isDraftActionLoading?: boolean
  /** Callback to convert an AI review item to a draft comment */
  onConvertAIToDraft?: (itemId: string) => Promise<void>
  /** Set of AI item IDs currently being converted */
  convertingAIItemIds?: Set<string>
  /** Operations for inline notebook judgment threads (pin/resolve/reply). */
  notebookJudgmentThreadOps?: NotebookJudgmentThreadOps
}

const AI_NOTEBOOK_AUTHOR = { type: "ai" as const, name: "Notebook" }

function judgmentThreadToComment(thread: NotebookJudgmentThread): ReviewComment {
  return {
    id: thread.id,
    filePath: thread.filePath,
    lineNumber: thread.lineNumber,
    side: thread.side,
    content: thread.content,
    author: AI_NOTEBOOK_AUTHOR,
    createdAt: thread.createdAt,
    replies: thread.replies,
    resolved: thread.resolved,
  }
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
  onEditReply,
  onDeleteReply,
  isDraftActionLoading,
  onConvertAIToDraft,
  convertingAIItemIds,
  notebookJudgmentThreadOps,
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
      aiCategories: meta.item.categories,
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

  if (meta.type === "notebook-judgment-thread") {
    const thread = meta.thread
    const ops = notebookJudgmentThreadOps
    const rootComment = judgmentThreadToComment(thread)

    return (
      <CommentThread.Inline
        comment={rootComment}
        lineNumber={annotation.lineNumber}
        aiSourceLabel="AI · needs your judgment"
        onReplySubmit={
          ops
            ? async (_commentId, content) => {
                await ops.reply(thread.id, content)
              }
            : undefined
        }
        threadLifecycle={
          ops
            ? {
                isPinned: thread.pinned,
                isResolved: thread.resolved,
                onPin: () => ops.pin(thread.id),
                onUnpin: () => ops.unpin(thread.id),
                onResolve: () => ops.resolve(thread.id),
                onUnresolve: () => ops.unresolve(thread.id),
                anchorReason: thread.anchorReason,
              }
            : undefined
        }
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
      onEditReply={onEditReply}
      onDeleteReply={onDeleteReply}
      isDraftActionLoading={isDraftActionLoading}
    />
  )
})
