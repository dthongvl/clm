import { useState, useCallback } from "react"
import {
  MultiFileDiff,
  type DiffLineAnnotation,
  type FileContents,
  type AnnotationSide,
} from "@pierre/diffs/react"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/ui/markdown"
import { Button } from "@/components/ui/button"
import type { ReviewComment } from "@/types/review"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { CommentForm } from "@/components/comment-thread/comment-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

/**
 * Data structure representing a file diff.
 */
export interface DiffFileData {
  /** The file path */
  path: string
  /** The old file path (for renamed files) */
  oldPath?: string
  /** The status of the file change */
  status: "added" | "modified" | "deleted" | "renamed"
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** The old file content */
  oldContent: string
  /** The new file content */
  newContent: string
}

/**
 * Draft annotation for showing comment form.
 */
export interface DraftAnnotation {
  /** Unique identifier for the draft */
  id: string
  /** The file path the draft belongs to */
  filePath: string
  /** Which side of the diff the draft is on */
  side: AnnotationSide
  /** The line number of the draft */
  lineNumber: number
}

/**
 * Props for the DiffViewer component.
 * Extends native div attributes for full customization.
 * 
 * @example
 * ```tsx
 * <DiffViewer
 *   files={diffFiles}
 *   annotations={comments}
 *   onCommentSubmit={handleSubmit}
 *   className="h-full"
 * />
 * ```
 */
export type DiffViewerProps = React.ComponentProps<"div"> & {
  /** Array of file diffs to display */
  files: DiffFileData[]
  /** Existing review comments/annotations */
  annotations?: ReviewComment[]
  /** Callback when a line is clicked */
  onLineClick?: (
    filePath: string,
    line: number,
    side: "additions" | "deletions"
  ) => void
  /** Callback when a file's viewed state changes */
  onFileViewedChange?: (filePath: string, isViewed: boolean) => void
  /** 
   * Set of file paths that are marked as viewed.
   * When provided, the component operates in controlled mode.
   */
  viewedFiles?: Set<string>
  /**
   * Default set of viewed files for uncontrolled mode.
   * @default new Set()
   */
  defaultViewedFiles?: Set<string>
  /** Callback when a new comment is submitted */
  onCommentSubmit?: (
    filePath: string,
    lineNumber: number,
    side: AnnotationSide,
    content: string
  ) => Promise<void>
  /** Callback when a reply to an existing comment is submitted */
  onReplySubmit?: (
    commentId: string,
    content: string
  ) => Promise<void>
}

/**
 * Converts path and content to FileContents format.
 */
function toFileContents(path: string, content: string): FileContents {
  return {
    name: path,
    contents: content,
  }
}

/** Metadata for annotations - can be either a comment or a draft form */
type AnnotationMetadata =
  | { type: "comment"; comment: ReviewComment }
  | { type: "draft"; draft: DraftAnnotation }

/**
 * Converts comments and drafts to line annotations format.
 */
function toLineAnnotations(
  comments: ReviewComment[],
  drafts: DraftAnnotation[],
  filePath: string
): DiffLineAnnotation<AnnotationMetadata>[] {
  const commentAnnotations: DiffLineAnnotation<AnnotationMetadata>[] = comments
    .filter((c) => c.filePath === filePath)
    .map((c) => ({
      side: "additions" as const,
      lineNumber: c.lineNumber,
      metadata: { type: "comment" as const, comment: c },
    }))

  const draftAnnotations: DiffLineAnnotation<AnnotationMetadata>[] = drafts
    .filter((d) => d.filePath === filePath)
    .map((d) => ({
      side: d.side,
      lineNumber: d.lineNumber,
      metadata: { type: "draft" as const, draft: d },
    }))

  return [...commentAnnotations, ...draftAnnotations]
}

/**
 * Severity badge component for displaying comment severity.
 */
function SeverityBadge({ severity }: { severity: ReviewComment["severity"] }) {
  if (!severity) return null

  return (
    <span
      role="status"
      aria-label={`Severity: ${severity}`}
      className={cn(
        "rounded-full px-1.5 py-0.5 text-xs",
        severity === "critical" && "bg-destructive text-destructive-foreground",
        severity === "warning" && "bg-warning text-warning-foreground",
        severity === "info" && "bg-muted text-muted-foreground"
      )}
    >
      {severity}
    </span>
  )
}

/**
 * Single comment component for rendering individual comments in a thread.
 */
function CommentItem({
  comment,
  isReply = false,
}: {
  comment: ReviewComment
  isReply?: boolean
}) {
  return (
    <div
      data-slot="comment-item"
      className={cn("p-2", isReply && "border-t border-border/50")}
      role="article"
      aria-label={`${isReply ? "Reply" : "Comment"} by ${comment.author.name}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{comment.author.name}</span>
        <SeverityBadge severity={comment.severity} />
      </div>
      <Markdown className="mt-1">{comment.content}</Markdown>
    </div>
  )
}

/**
 * Comment thread component for rendering a comment and all its replies.
 */
function CommentThread({
  comment,
  lineNumber,
  onReplySubmit,
  isSubmittingReply,
}: {
  comment: ReviewComment
  lineNumber: number
  onReplySubmit?: (commentId: string, content: string) => Promise<void>
  isSubmittingReply?: boolean
}) {
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

/**
 * A component for displaying code diffs with annotations and inline commenting.
 * 
 * Features:
 * - Split-view diff display
 * - Collapsible file sections
 * - Inline comment forms
 * - File viewed tracking (controlled or uncontrolled)
 * - Accessibility support with keyboard navigation
 * 
 * @example
 * ```tsx
 * // Uncontrolled mode
 * <DiffViewer
 *   files={diffFiles}
 *   annotations={comments}
 *   onCommentSubmit={async (filePath, lineNumber, side, content) => {
 *     await api.createComment({ filePath, lineNumber, side, content })
 *   }}
 * />
 * 
 * // Controlled mode
 * const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set())
 * <DiffViewer
 *   files={diffFiles}
 *   viewedFiles={viewedFiles}
 *   onFileViewedChange={(path, isViewed) => {
 *     setViewedFiles(prev => {
 *       const next = new Set(prev)
 *       isViewed ? next.add(path) : next.delete(path)
 *       return next
 *     })
 *   }}
 * />
 * ```
 * 
 * @remarks
 * - Supports both controlled and uncontrolled state for viewed files
 * - Keyboard accessible: Cmd+Enter to submit comments, Escape to cancel
 */
function DiffViewer({
  files,
  annotations = [],
  onLineClick,
  className,
  onFileViewedChange,
  viewedFiles: controlledViewedFiles,
  defaultViewedFiles,
  onCommentSubmit,
  onReplySubmit,
  ...props
}: DiffViewerProps) {
  // Track collapsed state for each file
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())

  // Internal viewed files state (used when not controlled)
  const [internalViewedFiles, setInternalViewedFiles] = useState<Set<string>>(
    () => defaultViewedFiles ?? new Set()
  )

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledViewedFiles !== undefined
  const viewedFiles = isControlled ? controlledViewedFiles : internalViewedFiles

  // Track draft annotations (open comment forms)
  const [draftAnnotations, setDraftAnnotations] = useState<DraftAnnotation[]>(
    []
  )

  // Track submitting state for new comments
  const [submittingDrafts, setSubmittingDrafts] = useState<Set<string>>(
    new Set()
  )

  // Track submitting state for replies
  const [submittingReplies, setSubmittingReplies] = useState<Set<string>>(
    new Set()
  )

  const handleToggleCollapse = useCallback((filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }, [])

  const handleToggleViewed = useCallback(
    (filePath: string) => {
      const newViewedState = !viewedFiles.has(filePath)

      // Update internal state if not controlled
      if (!isControlled) {
        setInternalViewedFiles((prev) => {
          const next = new Set(prev)
          if (newViewedState) {
            next.add(filePath)
          } else {
            next.delete(filePath)
          }
          return next
        })
      }

      // Auto-collapse when marking as viewed
      if (newViewedState) {
        setCollapsedFiles((prev) => {
          const next = new Set(prev)
          next.add(filePath)
          return next
        })
      }

      // Notify parent if callback provided
      onFileViewedChange?.(filePath, newViewedState)
    },
    [viewedFiles, isControlled, onFileViewedChange]
  )

  // Add a draft annotation (open comment form)
  const addDraftAnnotation = useCallback(
    (filePath: string, side: AnnotationSide, lineNumber: number) => {
      const id = `draft-${filePath}-${side}-${lineNumber}`

      // Check if already exists
      setDraftAnnotations((prev) => {
        const exists = prev.some(
          (d) =>
            d.filePath === filePath &&
            d.side === side &&
            d.lineNumber === lineNumber
        )
        if (exists) return prev

        return [...prev, { id, filePath, side, lineNumber }]
      })
    },
    []
  )

  // Cancel a draft annotation
  const cancelDraftAnnotation = useCallback(
    (filePath: string, side: AnnotationSide, lineNumber: number) => {
      setDraftAnnotations((prev) =>
        prev.filter(
          (d) =>
            !(
              d.filePath === filePath &&
              d.side === side &&
              d.lineNumber === lineNumber
            )
        )
      )
    },
    []
  )

  // Submit a draft annotation
  const submitDraftAnnotation = useCallback(
    async (
      filePath: string,
      side: AnnotationSide,
      lineNumber: number,
      content: string
    ) => {
      const draftId = `draft-${filePath}-${side}-${lineNumber}`

      if (!onCommentSubmit) {
        // If no submit handler, just remove the draft
        cancelDraftAnnotation(filePath, side, lineNumber)
        return
      }

      setSubmittingDrafts((prev) => new Set(prev).add(draftId))

      try {
        await onCommentSubmit(filePath, lineNumber, side, content)
        // Remove draft after successful submission
        cancelDraftAnnotation(filePath, side, lineNumber)
      } catch (error) {
        console.error("Failed to submit comment:", error)
      } finally {
        setSubmittingDrafts((prev) => {
          const next = new Set(prev)
          next.delete(draftId)
          return next
        })
      }
    },
    [onCommentSubmit, cancelDraftAnnotation]
  )

  // Submit a reply to an existing comment
  const submitReply = useCallback(
    async (commentId: string, content: string) => {
      if (!onReplySubmit) return

      setSubmittingReplies((prev) => new Set(prev).add(commentId))

      try {
        await onReplySubmit(commentId, content)
      } catch (error) {
        console.error("Failed to submit reply:", error)
      } finally {
        setSubmittingReplies((prev) => {
          const next = new Set(prev)
          next.delete(commentId)
          return next
        })
      }
    },
    [onReplySubmit]
  )

  // Check if there's an open comment form for a file
  const hasOpenCommentForm = useCallback(
    (filePath: string) =>
      draftAnnotations.some((d) => d.filePath === filePath),
    [draftAnnotations]
  )

  const createDiffOptions = useCallback(
    (filePath: string) => {
      const hasOpenForm = hasOpenCommentForm(filePath)
      return {
        diffStyle: "split" as const,
        expandUnchanged: false,
        expansionLineCount: 20,
        lineDiffType: "word" as const,
        hunkSeparators: "line-info" as const,
        disableFileHeader: true, // Disable default header to use our custom one
        enableHoverUtility: !hasOpenForm, // Disable hover utility when comment form is open
        onLineClick: onLineClick
          ? (lineProps: {
              lineNumber: number
              annotationSide: "additions" | "deletions"
            }) => {
              onLineClick(filePath, lineProps.lineNumber, lineProps.annotationSide)
            }
          : undefined,
      }
    },
    [hasOpenCommentForm, onLineClick]
  )

  if (files.length === 0) {
    return (
      <div
        data-slot="diff-viewer"
        data-state="empty"
        role="status"
        aria-label="No files to display"
        className={cn(
          "flex h-full flex-1 items-center justify-center bg-background text-muted-foreground",
          className
        )}
        {...props}
      >
        No files to display
      </div>
    )
  }

  return (
    <div
      data-slot="diff-viewer"
      data-state="loaded"
      className={cn("min-h-0 flex-1 overflow-auto bg-background", className)}
      {...props}
    >
      <div className="flex flex-col gap-4 p-4" role="list" aria-label="File diffs">
        {files.map((file) => {
          const oldFile = toFileContents(
            file.oldPath ?? file.path,
            file.oldContent
          )
          const newFile = toFileContents(file.path, file.newContent)
          const lineAnnotations = toLineAnnotations(
            annotations,
            draftAnnotations,
            file.path
          )

          const isCollapsed = collapsedFiles.has(file.path)
          const isViewed = viewedFiles.has(file.path)

          return (
            <div
              key={file.path}
              role="listitem"
              data-file-path={file.path}
              data-state={isCollapsed ? "collapsed" : "expanded"}
              data-viewed={isViewed}
              className="overflow-hidden rounded-lg border border-border"
            >
              {/* Custom collapsible file header */}
              <CollapsibleFileHeader
                filePath={file.path}
                status={file.status}
                additions={file.additions}
                deletions={file.deletions}
                isCollapsed={isCollapsed}
                isViewed={isViewed}
                onToggleCollapse={() => handleToggleCollapse(file.path)}
                onToggleViewed={() => handleToggleViewed(file.path)}
              />

              {/* Diff content - hidden when collapsed */}
              {!isCollapsed && (
                <MultiFileDiff<AnnotationMetadata>
                  oldFile={oldFile}
                  newFile={newFile}
                  options={createDiffOptions(file.path)}
                  lineAnnotations={lineAnnotations}
                  renderHoverUtility={(getHoveredLine) => (
                    <Button
                      size="icon-xs"
                      variant="default"
                      className="cursor-pointer bg-primary hover:bg-primary/90"
                      aria-label="Add comment to this line"
                      onClick={(event) => {
                        const hoveredLine = getHoveredLine()
                        if (hoveredLine == null) return
                        event.stopPropagation()
                        addDraftAnnotation(
                          file.path,
                          hoveredLine.side,
                          hoveredLine.lineNumber
                        )
                      }}
                    >
                      <HugeiconsIcon
                        icon={Add01Icon}
                        className="size-3"
                        aria-hidden="true"
                      />
                    </Button>
                  )}
                  renderAnnotation={(annotation) => {
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
                            submitDraftAnnotation(
                              meta.draft.filePath,
                              meta.draft.side,
                              meta.draft.lineNumber,
                              content
                            )
                          }
                          onCancel={() =>
                            cancelDraftAnnotation(
                              meta.draft.filePath,
                              meta.draft.side,
                              meta.draft.lineNumber
                            )
                          }
                          isLoading={isSubmitting}
                        />
                      )
                    }

                    // Render existing comment thread
                    return (
                      <CommentThread
                        comment={meta.comment}
                        lineNumber={annotation.lineNumber}
                        onReplySubmit={onReplySubmit ? submitReply : undefined}
                        isSubmittingReply={submittingReplies.has(meta.comment.id)}
                      />
                    )
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Export with named export matching the file name
export { DiffViewer }

// Also export as Viewer for backward compatibility
export { DiffViewer as Viewer }
