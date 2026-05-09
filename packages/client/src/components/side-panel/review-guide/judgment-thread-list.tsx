import { useCallback } from "react"
import { CommentThread } from "@/components/comment-thread"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Markdown } from "@/components/ui/markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { Pin02Icon, PinOffIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { JudgmentThread } from "@/types/review-guide"
import type { ReviewComment } from "@/types/review"

interface JudgmentThreadListProps {
  threads: JudgmentThread[]
  onPin: (threadId: string) => void
  onUnpin: (threadId: string) => void
  onResolve: (threadId: string) => void
  onUnresolve: (threadId: string) => void
  onReply: (threadId: string, reply: ReviewComment) => void
  onFileLineClick?: (filePath: string, lineNumber: number) => void
}

const AI_AUTHOR = { type: "ai" as const, name: "Review Guide" }

/** Synthesize a root `ReviewComment` so the existing CommentThread.Inline UI can render it. */
function toRootComment(thread: JudgmentThread): ReviewComment {
  return {
    id: thread.id,
    filePath: thread.filePath,
    lineNumber: thread.lineNumber,
    side: thread.side,
    content: thread.content,
    author: AI_AUTHOR,
    createdAt: thread.createdAt,
    replies: thread.replies,
    resolved: thread.resolved,
  }
}

function JudgmentThreadCard({
  thread,
  onPin,
  onUnpin,
  onResolve,
  onUnresolve,
  onReply,
  onFileLineClick,
}: {
  thread: JudgmentThread
} & Omit<JudgmentThreadListProps, "threads">) {
  const handleReply = useCallback(
    async (commentId: string, content: string) => {
      const reply: ReviewComment = {
        id: `${commentId}-reply-${Date.now()}`,
        filePath: thread.filePath,
        lineNumber: thread.lineNumber,
        side: thread.side,
        content,
        author: { type: "human", name: "You" },
        createdAt: new Date(),
        replies: [],
      }
      onReply(thread.id, reply)
    },
    [onReply, thread]
  )

  return (
    <div
      data-slot="judgment-thread-card"
      data-resolved={thread.resolved || undefined}
      data-pinned={thread.pinned || undefined}
      className={cn(
        "rounded-md border bg-card",
        thread.resolved && "opacity-70"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => onFileLineClick?.(thread.filePath, thread.lineNumber)}
          className="truncate font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          title={`${thread.filePath}:${thread.lineNumber}`}
        >
          {thread.filePath}:{thread.lineNumber}
        </button>
        <div className="flex items-center gap-1">
          {thread.resolved && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              Resolved
            </Badge>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => (thread.pinned ? onUnpin(thread.id) : onPin(thread.id))}
            aria-label={thread.pinned ? "Unpin thread" : "Pin thread"}
            aria-pressed={thread.pinned}
            className={cn(thread.pinned && "text-primary")}
          >
            <HugeiconsIcon
              icon={thread.pinned ? Pin02Icon : PinOffIcon}
              className="size-3"
            />
            {thread.pinned ? "Pinned" : "Pin"}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={() =>
              thread.resolved ? onUnresolve(thread.id) : onResolve(thread.id)
            }
          >
            {thread.resolved ? "Reopen" : "Resolve"}
          </Button>
        </div>
      </div>
      {thread.anchorReason && (
        <div className="border-b bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Why this needs you: </span>
          <Markdown className="inline [&_p]:my-0 [&_p]:inline">
            {thread.anchorReason}
          </Markdown>
        </div>
      )}
      <CommentThread.Inline
        comment={toRootComment(thread)}
        lineNumber={thread.lineNumber}
        aiSourceLabel="AI · needs your judgment"
        onReplySubmit={handleReply}
      />
    </div>
  )
}

function JudgmentThreadList({
  threads,
  onPin,
  onUnpin,
  onResolve,
  onUnresolve,
  onReply,
  onFileLineClick,
}: JudgmentThreadListProps) {
  if (threads.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {threads.map((thread) => (
        <JudgmentThreadCard
          key={thread.id}
          thread={thread}
          onPin={onPin}
          onUnpin={onUnpin}
          onResolve={onResolve}
          onUnresolve={onUnresolve}
          onReply={onReply}
          onFileLineClick={onFileLineClick}
        />
      ))}
    </div>
  )
}

export { JudgmentThreadList }
