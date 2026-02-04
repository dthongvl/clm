import { useState, useCallback, useMemo } from "react"
import {
  MultiFileDiff,
  type DiffLineAnnotation,
  type FileContents,
  type AnnotationSide,
} from "@pierre/diffs/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ReviewComment, AIReviewItem } from "@/types/review"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { CommentThread } from "@/components/comment-thread"
import { CommentForm } from "@/components/comment-thread/comment-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { useTheme } from "@/components/theme-provider"

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
  /** AI review items to display as comment threads */
  aiReviewItems?: AIReviewItem[]
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

/** Metadata for annotations - can be a comment, draft form, or AI review item */
type AnnotationMetadata =
  | { type: "comment"; comment: ReviewComment }
  | { type: "draft"; draft: DraftAnnotation }
  | { type: "ai-review"; item: AIReviewItem }

/**
 * Check if two file paths match, handling different path formats.
 * Matches if paths are equal, or if one ends with the other.
 */
function pathsMatch(path1: string, path2: string): boolean {
  if (path1 === path2) return true
  // Normalize paths by removing leading slashes
  const normalized1 = path1.replace(/^\/+/, "")
  const normalized2 = path2.replace(/^\/+/, "")
  if (normalized1 === normalized2) return true
  // Check if one path ends with the other (handles relative vs absolute paths)
  return normalized1.endsWith(normalized2) || normalized2.endsWith(normalized1)
}

/**
 * Converts comments, drafts, and AI review items to line annotations format.
 */
function toLineAnnotations(
  comments: ReviewComment[],
  drafts: DraftAnnotation[],
  aiReviewItems: AIReviewItem[],
  filePath: string
): DiffLineAnnotation<AnnotationMetadata>[] {
  const commentAnnotations: DiffLineAnnotation<AnnotationMetadata>[] = comments
    .filter((c) => c.filePath === filePath)
    .map((c) => ({
      side: c.side,
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

  const aiReviewAnnotations: DiffLineAnnotation<AnnotationMetadata>[] = aiReviewItems
    .filter((item) => pathsMatch(item.filePath, filePath))
    .map((item) => ({
      side: "additions" as const,
      lineNumber: item.lineNumber,
      metadata: { type: "ai-review" as const, item },
    }))

  return [...commentAnnotations, ...draftAnnotations, ...aiReviewAnnotations]
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
  aiReviewItems = [],
  ...props
}: DiffViewerProps) {
  // Get current theme from theme provider
  const { theme } = useTheme()

  // Resolve theme (handle "system" by checking media query)
  const resolvedTheme = useMemo(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }
    return theme
  }, [theme])

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
        themeType: resolvedTheme, // Pass the current theme to the diff component
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
    [hasOpenCommentForm, onLineClick, resolvedTheme]
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
      className={cn("min-h-0 flex-1 overflow-hidden bg-background", className)}
      {...props}
    >
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4 p-4 pb-24" role="list" aria-label="File diffs">
        {files.map((file) => {
          const oldFile = toFileContents(
            file.oldPath ?? file.path,
            file.oldContent
          )
          const newFile = toFileContents(file.path, file.newContent)
          const lineAnnotations = toLineAnnotations(
            annotations,
            draftAnnotations,
            aiReviewItems,
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

                    if (meta.type === "ai-review") {
                      // Convert AI review item to ReviewComment format for display
                      // AI reviews are always on the additions (new code) side
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

                      return (
                        <CommentThread.Inline
                          comment={aiComment}
                          lineNumber={annotation.lineNumber}
                        />
                      )
                    }

                    // Render existing comment thread
                    return (
                      <CommentThread.Inline
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

        {/* Footer spacer to avoid overlap with floating chat trigger */}
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <span>🎉 You've reached the end — happy reviewing!</span>
        </div>
      </div>
      </ScrollArea>
    </div>
  )
}

// Export with named export matching the file name
export { DiffViewer }

// Also export as Viewer for backward compatibility
export { DiffViewer as Viewer }
