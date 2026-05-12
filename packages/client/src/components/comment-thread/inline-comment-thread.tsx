import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { Markdown } from "@/components/ui/markdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, SparklesIcon, UserIcon } from "@hugeicons/core-free-icons"
import type { ReviewComment, AIReviewCategory } from "@/types/review"
import { CommentForm } from "./comment-form"

const CATEGORY_SHORT_LABELS: Record<AIReviewCategory, string> = {
  "code-quality": "Quality",
  "coding-convention": "Convention",
  "security": "Security",
  "accessibility": "A11y",
  "architecture": "Arch",
  "api-design": "API",
  "performance": "Perf",
  "testing": "Testing",
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
  /** Callback when a draft comment is edited */
  onEditDraft?: (commentId: string, content: string) => Promise<void>
  /** Callback when a draft comment is deleted */
  onDeleteDraft?: (commentId: string) => Promise<void>
  /** Whether a draft action (edit/delete) is currently loading */
  isDraftActionLoading?: boolean
  /** Callback when an AI comment is converted to a draft */
  onConvertToDraft?: () => Promise<void>
  /** Whether the AI comment is currently being converted to a draft */
  isConvertingToDraft?: boolean
  /** Callback when a reply comment is edited */
  onEditReply?: (commentId: string, content: string) => Promise<void>
  /** Callback when a reply comment is deleted */
  onDeleteReply?: (commentId: string) => Promise<void>
  /**
   * Optional provenance label for AI-emitted threads. When set on an AI-authored
   * thread, replaces the generic "AI" badge with a labeled provenance badge
   * (e.g. "AI · needs your judgment"). Persists after resolution.
   */
  aiSourceLabel?: string
  /**
   * Optional notebook judgment-thread lifecycle controls. When all are
   * provided, the action bar renders pin/unpin and resolve/unresolve buttons
   * alongside the standard Reply affordance. The thread itself is rendered
   * through the same shared inline-thread chrome as comments and drafts.
   */
  threadLifecycle?: {
    isPinned: boolean
    isResolved: boolean
    onPin: () => void
    onUnpin: () => void
    onResolve: () => void
    onUnresolve: () => void
    /** Optional anchor reason rendered as a one-line subtle banner. */
    anchorReason?: string
  }
}

/**
 * Avatar component for comment authors
 */
function AuthorAvatar({ isAI, avatarUrl, name }: { isAI: boolean; avatarUrl?: string; name: string }) {
  if (avatarUrl) {
    return (
      <img
        data-slot="author-avatar"
        src={avatarUrl}
        alt={`${name}'s avatar`}
        referrerPolicy="no-referrer"
        className="size-6 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <div
      data-slot="author-avatar"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
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
  onEdit,
  onDelete,
  aiSourceLabel,
}: {
  comment: ReviewComment
  isReply?: boolean
  onEdit?: (commentId: string, content: string) => Promise<void>
  onDelete?: (commentId: string) => Promise<void>
  aiSourceLabel?: string
}) {
  const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isSaving, setIsSaving] = useState(false)

  const handleEditSave = async () => {
    if (!onEdit || !editContent.trim()) return
    setIsSaving(true)
    try {
      await onEdit(comment.id, editContent.trim())
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const isAI = comment.author.type === "ai"
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(comment.createdAt))

  // Show up to 2 category badges + overflow count
  const categories = comment.aiCategories || []
  const visibleCategories = categories.slice(0, 2)
  const remainingCount = categories.length - 2

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
        <AuthorAvatar isAI={isAI} avatarUrl={comment.author.avatarUrl} name={comment.author.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-xs font-semibold", isAI && "text-primary")}>
              {comment.author.name}
            </span>
            {isAI && (
              aiSourceLabel ? (
                <Badge
                  variant="outline"
                  className="h-4 gap-1 px-1.5 text-[10px] text-primary border-primary/30 bg-primary/5"
                  aria-label={aiSourceLabel}
                >
                  {aiSourceLabel}
                </Badge>
              ) : (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]" aria-label="AI generated">
                  AI
                </Badge>
              )
            )}
            {comment.severity && (
              <SeverityBadge severity={comment.severity}>
                {comment.severity}
              </SeverityBadge>
            )}
            {visibleCategories.map((category) => (
              <Badge key={category} variant="outline" className="h-4 px-1.5 text-[10px]">
                {CATEGORY_SHORT_LABELS[category]}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                +{remainingCount}
              </Badge>
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
            {isEditing ? (
              <>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="border-transparent bg-muted/50 focus-visible:border-input focus-visible:bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleEditSave()
                    } else if (e.key === "Escape") {
                      e.preventDefault()
                      setIsEditing(false)
                      setEditContent(comment.content)
                    }
                  }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={handleEditSave} disabled={!editContent.trim() || isSaving}>
                    {isSaving ? (
                      <>
                        <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditContent(comment.content) }}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : comment.isStreaming && !comment.content ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            ) : (
              <Markdown>{comment.content}</Markdown>
            )}
          </div>
          {(onEdit || onDelete) && !isEditing && (
            <div className="mt-1.5 flex items-center gap-1">
              {onEdit && (
                <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
              {onDelete && (
                <Popover open={isDeletePopoverOpen} onOpenChange={setIsDeletePopoverOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="ghost" size="xs" disabled={isDeleting} className="text-muted-foreground hover:text-destructive">
                        {isDeleting ? (
                          <>
                            <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </Button>
                    }
                  />
                  <PopoverContent side="top" className="w-auto max-w-56">
                    <PopoverHeader>
                      <PopoverTitle>Delete reply?</PopoverTitle>
                      <PopoverDescription>
                        This action cannot be undone.
                      </PopoverDescription>
                    </PopoverHeader>
                    <div className="flex justify-end gap-2">
                      <PopoverClose render={<Button variant="outline" size="xs">Cancel</Button>} />
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={async () => {
                          setIsDeletePopoverOpen(false)
                          setIsDeleting(true)
                          try {
                            await onDelete(comment.id)
                          } finally {
                            setIsDeleting(false)
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
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
  onEditDraft,
  onDeleteDraft,
  isDraftActionLoading,
  onConvertToDraft,
  isConvertingToDraft,
  onEditReply,
  onDeleteReply,
  aiSourceLabel,
  threadLifecycle,
}: InlineCommentThreadProps) {
  const [isReplyFormOpen, setIsReplyFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false)
  const hasReplies = comment.replies && comment.replies.length > 0
  const isDraftEditable = comment.isDraft && comment.editable
  const isAIComment = comment.author.type === "ai"
  const canConvertToDraft = isAIComment && onConvertToDraft

  const handleReplySubmit = async (content: string) => {
    if (!onReplySubmit) return
    await onReplySubmit(comment.id, content)
    setIsReplyFormOpen(false)
  }

  const handleEditSave = async () => {
    if (!onEditDraft || !editContent.trim()) return
    await onEditDraft(comment.id, editContent.trim())
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!onDeleteDraft) return
    setIsDeletePopoverOpen(false)
    await onDeleteDraft(comment.id)
  }

  return (
    <div
      data-slot="comment-annotation"
      data-annotation-line={lineNumber}
      className="m-5 max-w-[95%] whitespace-normal sm:max-w-[90%]"
      role="region"
      aria-label={`Comment thread started by ${comment.author.name}`}
    >
      <div className="overflow-hidden rounded-lg border bg-card p-5 text-sm shadow-sm">
      {isEditing ? (
        <div className="p-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="border-transparent bg-muted/50 focus-visible:border-input focus-visible:bg-transparent"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleEditSave()
              } else if (e.key === "Escape") {
                e.preventDefault()
                setIsEditing(false)
                setEditContent(comment.content)
              }
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={handleEditSave} disabled={!editContent.trim() || isDraftActionLoading}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditContent(comment.content) }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {threadLifecycle?.anchorReason && (
            <div className="border-b bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">
                Why this needs you:{" "}
              </span>
              <Markdown className="inline [&_p]:my-0 [&_p]:inline">
                {threadLifecycle.anchorReason}
              </Markdown>
            </div>
          )}
          <CommentItem comment={comment} aiSourceLabel={aiSourceLabel} />
        </>
      )}

      {hasReplies && (
        <>
          <Separator />
          <div data-slot="comment-replies">
            {comment.replies!.map((reply, index) => (
              <div key={reply.id}>
                {index > 0 && <Separator />}
                <CommentItem comment={reply} isReply onEdit={onEditReply} onDelete={onDeleteReply} />
              </div>
            ))}
          </div>
        </>
      )}

      <Separator />
      <div className="px-3 py-2.5 flex items-center gap-1">
        {isDraftEditable && !isEditing && (
          <>
            <Badge variant="outline" className="mr-1 h-5 px-1.5 text-[10px] text-amber-600 border-amber-600/30">
              Pending
            </Badge>
            <Button variant="ghost" size="xs" onClick={() => setIsEditing(true)} disabled={isDraftActionLoading} className="text-muted-foreground hover:text-foreground">
              Edit
            </Button>
            <Popover open={isDeletePopoverOpen} onOpenChange={setIsDeletePopoverOpen}>
              <PopoverTrigger
                render={
                  <Button variant="ghost" size="xs" disabled={isDraftActionLoading} className="text-muted-foreground hover:text-destructive">
                    {isDraftActionLoading ? (
                      <>
                        <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </Button>
                }
              />
              <PopoverContent side="top" className="w-auto max-w-56">
                <PopoverHeader>
                  <PopoverTitle>Delete comment?</PopoverTitle>
                  <PopoverDescription>
                    This action cannot be undone.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex justify-end gap-2">
                  <PopoverClose render={<Button variant="outline" size="xs">Cancel</Button>} />
                  <Button size="xs" variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex-1" />
          </>
        )}
        {!isDraftEditable && !isEditing && (
          <>
            {canConvertToDraft && (
              <Button
                variant="ghost"
                size="xs"
                className="-ml-2 text-muted-foreground hover:text-foreground"
                onClick={onConvertToDraft}
                disabled={isConvertingToDraft}
                aria-label="Add this AI suggestion to your draft review"
              >
                {isConvertingToDraft ? (
                  <>
                    <HugeiconsIcon icon={Loading03Icon} className="mr-1 size-3 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add to draft"
                )}
              </Button>
            )}
            {threadLifecycle && (
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  className={cn(
                    "-ml-2 text-muted-foreground hover:text-foreground",
                    threadLifecycle.isPinned && "text-primary",
                  )}
                  onClick={() =>
                    threadLifecycle.isPinned
                      ? threadLifecycle.onUnpin()
                      : threadLifecycle.onPin()
                  }
                  aria-pressed={threadLifecycle.isPinned}
                  aria-label={threadLifecycle.isPinned ? "Unpin thread" : "Pin thread"}
                >
                  {threadLifecycle.isPinned ? "Pinned" : "Pin"}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    threadLifecycle.isResolved
                      ? threadLifecycle.onUnresolve()
                      : threadLifecycle.onResolve()
                  }
                  aria-pressed={threadLifecycle.isResolved}
                  aria-label={
                    threadLifecycle.isResolved ? "Reopen thread" : "Resolve thread"
                  }
                >
                  {threadLifecycle.isResolved ? "Reopen" : "Resolve"}
                </Button>
              </>
            )}
            {onReplySubmit && !canConvertToDraft && (
              <>
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
                  <div className="w-full">
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
              </>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  )
}

export { InlineCommentThread }
