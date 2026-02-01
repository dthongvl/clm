import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { Markdown } from "@/components/ui/markdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Card } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, SparklesIcon, UserIcon } from "@hugeicons/core-free-icons"
import type { ReviewComment } from "@/types/review"
import { CommentForm } from "./comment-form"

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
 * Avatar component for comment authors
 */
function AuthorAvatar({ isAI }: { isAI: boolean }) {
  return (
    <div
      data-slot="author-avatar"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center",
        isAI
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      <HugeiconsIcon
        icon={isAI ? SparklesIcon : UserIcon}
        className="size-3.5"
        aria-hidden="true"
      />
    </div>
  )
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
      className={cn(
        "px-3 py-3",
        isReply && "bg-muted/30"
      )}
      role="article"
      aria-label={`${isReply ? "Reply" : "Comment"} by ${comment.author.name}`}
    >
      <div className="flex gap-2.5">
        <AuthorAvatar isAI={isAI} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-xs font-semibold", isAI && "text-primary")}>
              {comment.author.name}
            </span>
            {isAI && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]" aria-label="AI generated">
                AI
              </Badge>
            )}
            {comment.severity && (
              <SeverityBadge severity={comment.severity}>
                {comment.severity}
              </SeverityBadge>
            )}
            <span className="text-muted-foreground">·</span>
            {comment.isStreaming ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-3 animate-spin"
                  aria-hidden="true"
                />
                <span>Thinking...</span>
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
          <div data-slot="comment-content" className="mt-2">
            {comment.isStreaming && !comment.content ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            ) : (
              <Markdown>{comment.content}</Markdown>
            )}
          </div>
        </div>
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
  const hasReplies = comment.replies && comment.replies.length > 0

  const handleReplySubmit = async (content: string) => {
    if (!onReplySubmit) return
    await onReplySubmit(comment.id, content)
    setIsReplyFormOpen(false)
  }

  return (
    <Card
      data-slot="comment-annotation"
      data-annotation-line={lineNumber}
      size="sm"
      className="overflow-hidden border-l-2 border-l-primary py-0 text-sm"
      role="region"
      aria-label={`Comment thread started by ${comment.author.name}`}
    >
      <CommentItem comment={comment} />

      {hasReplies && (
        <>
          <Separator />
          <div data-slot="comment-replies">
            {comment.replies!.map((reply, index) => (
              <div key={reply.id}>
                {index > 0 && <Separator />}
                <CommentItem comment={reply} isReply />
              </div>
            ))}
          </div>
        </>
      )}

      <Separator />
      <div className="px-3 py-2.5">
        {!isReplyFormOpen ? (
          <Button
            variant="ghost"
            size="xs"
            className="-ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsReplyFormOpen(true)}
            aria-label="Reply to this thread"
          >
            Reply
          </Button>
        ) : (
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
        )}
      </div>
    </Card>
  )
}

export { InlineCommentThread }
