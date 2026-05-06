import { useState, useCallback, useMemo, useEffect, useRef, useSyncExternalStore } from "react"
import {
  forwardRef,
  useImperativeHandle,
} from "react"
import {
  type DiffLineAnnotation,
  type AnnotationSide,
} from "@pierre/diffs/react"
import { Virtualizer } from "@pierre/diffs/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowUpIcon } from "lucide-react"
import { useScrollToTop } from "@/hooks"
import type { ReviewComment, AIReviewItem } from "@/types/review"
import { useTheme } from "@/components/theme-provider"
import type { DiffFileData } from "@/types/diff"
import { FileDiffCard } from "./file-diff-card"
import { FileSourceDialog } from "./file-source-dialog"

export type { DiffFileData } from "@/types/diff"

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
  /** Callback when a draft comment is edited */
  onEditDraft?: (commentId: string, content: string) => Promise<void>
  /** Callback when a draft comment is deleted */
  onDeleteDraft?: (commentId: string) => Promise<void>
  /** Callback when a reply comment is edited */
  onEditReply?: (commentId: string, content: string) => Promise<void>
  /** Callback when a reply comment is deleted */
  onDeleteReply?: (commentId: string) => Promise<void>
  /** Whether a draft action (edit/delete) is currently loading */
  isDraftActionLoading?: boolean
  /** Callback to convert an AI review item to a draft comment */
  onConvertAIToDraft?: (itemId: string) => Promise<void>
  /** Set of AI item IDs currently being converted */
  convertingAIItemIds?: Set<string>
  /** Set of file paths currently syncing viewed state with server */
  syncingViewedFiles?: Set<string>
}

/**
 * Ref handle for DiffViewer component.
 * Provides imperative methods for controlling the viewer.
 */
export interface DiffViewerRef {
  /** Expand a collapsed file by path */
  expandFile: (filePath: string) => void
}

const getMediaQuery = () =>
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null

const subscribeSystemTheme = (cb: () => void) => {
  const mq = getMediaQuery()
  if (!mq) return () => {}
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
const getSystemThemeSnapshot = (): "dark" | "light" => getMediaQuery()?.matches ? "dark" : "light"

/** Metadata for annotations - can be a comment, draft form, or AI review item */
export type AnnotationMetadata =
  | { type: "comment"; comment: ReviewComment }
  | { type: "draft"; draft: DraftAnnotation }
  | { type: "ai-review"; item: AIReviewItem }

/**
 * Pre-indexes annotations, drafts, and AI review items by file path.
 * Returns a Map so each file's annotation array is a stable reference.
 */
function useAnnotationIndex(
  comments: ReviewComment[],
  drafts: DraftAnnotation[],
  aiReviewItems: AIReviewItem[],
) {
  return useMemo(() => {
    const commentsByFile = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    for (const c of comments) {
      const arr = commentsByFile.get(c.filePath) ?? []
      arr.push({
        side: c.side,
        lineNumber: c.lineNumber,
        metadata: { type: "comment" as const, comment: c },
      })
      commentsByFile.set(c.filePath, arr)
    }

    const draftsByFile = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    for (const d of drafts) {
      const arr = draftsByFile.get(d.filePath) ?? []
      arr.push({
        side: d.side,
        lineNumber: d.lineNumber,
        metadata: { type: "draft" as const, draft: d },
      })
      draftsByFile.set(d.filePath, arr)
    }

    // AI review items use normalized paths (strip leading slashes)
    const aiByFile = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    for (const item of aiReviewItems) {
      const normalizedPath = item.filePath.replace(/^\/+/, "")
      const arr = aiByFile.get(normalizedPath) ?? []
      arr.push({
        side: "additions" as const,
        lineNumber: item.lineNumber,
        metadata: { type: "ai-review" as const, item },
      })
      aiByFile.set(normalizedPath, arr)
    }

    const result = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    const allPaths = new Set([
      ...commentsByFile.keys(),
      ...draftsByFile.keys(),
      ...aiByFile.keys(),
    ])
    for (const path of allPaths) {
      const normalizedPath = path.replace(/^\/+/, "")
      const combined = [
        ...(commentsByFile.get(path) ?? []),
        ...(draftsByFile.get(path) ?? []),
        ...(aiByFile.get(normalizedPath) ?? []),
      ]
      if (combined.length > 0) {
        result.set(path, combined)
      }
    }

    return result
  }, [comments, drafts, aiReviewItems])
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
const DiffViewer = forwardRef<DiffViewerRef, DiffViewerProps>(function DiffViewer({
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
  onEditDraft,
  onDeleteDraft,
  onEditReply,
  onDeleteReply,
  isDraftActionLoading,
  onConvertAIToDraft,
  convertingAIItemIds,
  syncingViewedFiles,
  ...props
}, ref) {
  // Get current theme from theme provider
  const { theme } = useTheme()

  // Subscribe to OS dark/light changes so diff view updates reactively
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemThemeSnapshot)
  const resolvedTheme = theme === "system" ? systemTheme : theme

  // Ref for scroll-to-top functionality
  const containerRef = useRef<HTMLDivElement>(null)
  const { showScrollTop, scrollToTop } = useScrollToTop(containerRef)

  // Track collapsed state for each file — start with viewed files collapsed
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(
    () => new Set(controlledViewedFiles ?? defaultViewedFiles ?? [])
  )

  // Internal viewed files state (used when not controlled)
  const [internalViewedFiles, setInternalViewedFiles] = useState<Set<string>>(
    () => defaultViewedFiles ?? new Set()
  )

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledViewedFiles !== undefined
  const viewedFiles = isControlled ? controlledViewedFiles : internalViewedFiles

  // Collapse files that become viewed in controlled mode
  const prevViewedRef = useRef<Set<string>>(viewedFiles)
  useEffect(() => {
    const prev = prevViewedRef.current
    if (viewedFiles !== prev) {
      const newlyViewed = [...viewedFiles].filter((f) => !prev.has(f))
      if (newlyViewed.length > 0) {
        setCollapsedFiles((c) => {
          const next = new Set(c)
          for (const f of newlyViewed) next.add(f)
          return next
        })
      }
      prevViewedRef.current = viewedFiles
    }
  }, [viewedFiles])

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

  const getAnnotationsForFile = useAnnotationIndex(annotations, draftAnnotations, aiReviewItems)

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    expandFile: (filePath: string) => {
      const normalizedPath = filePath.replace(/^\/+/, "")
      setCollapsedFiles((prev) => {
        if (prev.has(normalizedPath)) {
          const next = new Set(prev)
          next.delete(normalizedPath)
          return next
        }
        return prev
      })
    },
  }), [])

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

  // Source view dialog state
  const [sourceView, setSourceView] = useState<{ filePath: string; content: string } | null>(null)

  const handleViewHeadFile = useCallback((payload: { filePath: string; content: string }) => {
    setSourceView(payload)
  }, [])

  const handleSourceDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setSourceView(null)
  }, [])

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
      ref={containerRef}
      data-slot="diff-viewer"
      data-state="loaded"
      className={cn("relative min-h-0 flex-1 overflow-hidden bg-background", className)}
      {...props}
    >
      <Virtualizer className="h-full overflow-auto" contentClassName="p-4 pb-24">
        <div className="flex flex-col gap-4" role="list" aria-label="File diffs">
          {files.map((file) => (
            <FileDiffCard
              key={file.path}
              file={file}
              lineAnnotations={getAnnotationsForFile.get(file.path) ?? []}
              isCollapsed={collapsedFiles.has(file.path)}
              isViewed={viewedFiles.has(file.path)}
              isSyncingViewed={syncingViewedFiles?.has(file.path)}
              resolvedTheme={resolvedTheme}
              hasOpenCommentForm={draftAnnotations.some((d) => d.filePath === file.path)}
              submittingDrafts={submittingDrafts}
              submittingReplies={submittingReplies}
              onToggleCollapse={handleToggleCollapse}
              onToggleViewed={handleToggleViewed}
              onAddDraft={addDraftAnnotation}
              onSubmitDraft={submitDraftAnnotation}
              onCancelDraft={cancelDraftAnnotation}
              onSubmitReply={onReplySubmit ? submitReply : undefined}
              onEditDraft={onEditDraft}
              onDeleteDraft={onDeleteDraft}
              onEditReply={onEditReply}
              onDeleteReply={onDeleteReply}
              isDraftActionLoading={isDraftActionLoading}
              onLineClick={onLineClick}
              onConvertAIToDraft={onConvertAIToDraft}
              convertingAIItemIds={convertingAIItemIds}
              onViewHeadFile={handleViewHeadFile}
            />
          ))}
        </div>

        {/* Footer spacer */}
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <span>🎉 You've reached the end — happy reviewing!</span>
        </div>
      </Virtualizer>

      {/* Scroll to top button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "absolute bottom-4 right-4 z-10 shadow-md transition-opacity duration-200",
          showScrollTop ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <ArrowUpIcon className="size-4" />
      </Button>

      {/* Head file source dialog */}
      <FileSourceDialog
        open={sourceView !== null}
        onOpenChange={handleSourceDialogOpenChange}
        filePath={sourceView?.filePath ?? ""}
        content={sourceView?.content ?? ""}
        resolvedTheme={resolvedTheme}
        refLabel="Head"
      />
    </div>
  )
})

// Export with named export matching the file name
export { DiffViewer }

// Also export as Viewer for backward compatibility
export { DiffViewer as Viewer }
