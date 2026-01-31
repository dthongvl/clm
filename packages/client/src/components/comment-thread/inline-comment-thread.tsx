import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Markdown } from "@/components/ui/markdown"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import type { ReviewComment, Severity } from "@/types/review"
import { CommentForm } from "./comment-form"

const severityVariantMap: Record<Severity, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

/**
 * Props for the InlineCommentThread component.
 */
export interface InlineCommentThreadProps {
  /** The root comment of the thread */
  comment: ReviewComment
  /** The line number this thread is attached to */
  lineNumber: number
  /** Callback when a reply is submitted */
  onReplySubmit?: (commentId: string, content: string) => Promise<void>
  /** Whether a reply is currently being submitted */
  isSubmittingReply?: boolean
}

/**
 * Single comment component for rendering individual comments in a thread.
 * Supports AI badges, severity indicators, timestamps, and streaming state.
 */
function CommentItem({
  comment,
  isReply = false,
}: {
  comment: ReviewComment
  isReply?: boolean
}) {
  const isAI = comment.author.type === "ai"
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(comment.createdAt))

  return (
    <div
      data-slot="comment-item"
      data-author-type={comment.author.type}
      data-streaming={comment.isStreaming || undefined}
      className={cn("p-2", isReply && "border-t border-border/50")}
      role="article"
      aria-label={`${isReply ? "Reply" : "Comment"} by ${comment.author.name}`}
    >
      <div className="flex items-center gap-2">
        <span className={cn("font-medium", isAI && "text-primary")}>
          {comment.author.name}
        </span>
        {isAI && (
          <Badge variant="secondary" className="text-xs" aria-label="AI generated">
            AI
          </Badge>
        )}
        {comment.severity && (
          <Badge variant={severityVariantMap[comment.severity]}>
            {comment.severity}
          </Badge>
        )}
        {comment.isStreaming ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-3 animate-spin"
              aria-hidden="true"
            />
            Thinking...
          </span>
        ) : (
          <time
            data-slot="comment-timestamp"
            dateTime={new Date(comment.createdAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formattedDate}
          </time>
        )}
      </div>
      <div data-slot="comment-content" className="mt-1">
        {comment.isStreaming && !comment.content ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-pulse rounded bg-muted" />
            <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <Markdown>{comment.content}</Markdown>
        )}
      </div>
    </div>
  )
}

/**
 * Inline comment thread component for rendering a comment and all its replies
 * within a diff view annotation.
 *
 * @example
 * ```tsx
 * <InlineCommentThread
 *   comment={comment}
 *   lineNumber={42}
 *   onReplySubmit={async (commentId, content) => {
 *     await api.replyToComment(commentId, content)
 *   }}
 * />
 * ```
 */
function InlineCommentThread({
  comment,
  lineNumber,
  onReplySubmit,
  isSubmittingReply,
}: InlineCommentThreadProps) {
  const [isReplyFormOpen, setIsReplyFormOpen] = useState(false)

  const handleReplySubmit = async (content: string) => {
    if (!onReplySubmit) return
    await onReplySubmit(comment.id, content)
    setIsReplyFormOpen(false)
  }

  return (
    <div
      data-slot="comment-annotation"
      data-annotation-line={lineNumber}
      className="border-l-2 border-primary bg-muted/50 text-sm"
      role="region"
      aria-label={`Comment thread started by ${comment.author.name}`}
    >
      <CommentItem comment={comment} />
      {comment.replies && comment.replies.length > 0 && (
        <div data-slot="comment-replies" className="ml-4 border-l border-border/50">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} isReply />
          ))}
        </div>
      )}
      {/* Reply action and form */}
      <div className="p-2 pt-0">
        {!isReplyFormOpen ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsReplyFormOpen(true)}
            aria-label="Reply to this thread"
          >
            Reply
          </Button>
        ) : (
          <div className="mt-2">
            <CommentForm
              variant="default"
              size="sm"
              autoFocus
              showKeyboardHints
              placeholder="Write a reply..."
              onSubmit={handleReplySubmit}
              onCancel={() => setIsReplyFormOpen(false)}
              isLoading={isSubmittingReply}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export { InlineCommentThread }
