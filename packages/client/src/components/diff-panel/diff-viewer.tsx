import { useState, useCallback, useRef, useEffect } from "react"
import {
  MultiFileDiff,
  type DiffLineAnnotation,
  type FileContents,
  type AnnotationSide,
} from "@pierre/diffs/react"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/ui/markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ReviewComment } from "@/types/review"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Loading03Icon } from "@hugeicons/core-free-icons"

export interface DiffFileData {
  path: string
  oldPath?: string
  status: "added" | "modified" | "deleted" | "renamed"
  additions: number
  deletions: number
  oldContent: string
  newContent: string
}

/** Draft annotation for showing comment form */
export interface DraftAnnotation {
  id: string
  filePath: string
  side: AnnotationSide
  lineNumber: number
}

export interface DiffPanelViewerProps {
  files: DiffFileData[]
  annotations?: ReviewComment[]
  onLineClick?: (
    filePath: string,
    line: number,
    side: "additions" | "deletions"
  ) => void
  className?: string
  /** Callback when a file's viewed state changes */
  onFileViewedChange?: (filePath: string, isViewed: boolean) => void
  /** Initial state for viewed files (file paths that are already viewed) */
  viewedFiles?: Set<string>
  /** Callback when a new comment is submitted */
  onCommentSubmit?: (
    filePath: string,
    lineNumber: number,
    side: AnnotationSide,
    content: string
  ) => Promise<void>
}

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

function Viewer({
  files,
  annotations = [],
  onLineClick,
  className,
  onFileViewedChange,
  viewedFiles: controlledViewedFiles,
  onCommentSubmit,
}: DiffPanelViewerProps) {
  // Track collapsed state for each file
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  
  // Internal viewed files state (used when not controlled)
  const [internalViewedFiles, setInternalViewedFiles] = useState<Set<string>>(new Set())
  
  // Use controlled state if provided, otherwise use internal state
  const viewedFiles = controlledViewedFiles ?? internalViewedFiles

  // Track draft annotations (open comment forms)
  const [draftAnnotations, setDraftAnnotations] = useState<DraftAnnotation[]>([])
  
  // Track submitting state
  const [submittingDrafts, setSubmittingDrafts] = useState<Set<string>>(new Set())

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

  const handleToggleViewed = useCallback((filePath: string) => {
    const newViewedState = !viewedFiles.has(filePath)
    
    // Update internal state if not controlled
    if (controlledViewedFiles === undefined) {
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
  }, [viewedFiles, controlledViewedFiles, onFileViewedChange])

  // Add a draft annotation (open comment form)
  const addDraftAnnotation = useCallback(
    (filePath: string, side: AnnotationSide, lineNumber: number) => {
      const id = `draft-${filePath}-${side}-${lineNumber}`
      
      // Check if already exists
      setDraftAnnotations((prev) => {
        const exists = prev.some(
          (d) => d.filePath === filePath && d.side === side && d.lineNumber === lineNumber
        )
        if (exists) return prev
        
        return [
          ...prev,
          { id, filePath, side, lineNumber },
        ]
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
            !(d.filePath === filePath && d.side === side && d.lineNumber === lineNumber)
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

  // Check if there's an open comment form for a file
  const hasOpenCommentForm = useCallback(
    (filePath: string) => draftAnnotations.some((d) => d.filePath === filePath),
    [draftAnnotations]
  )

  const createDiffOptions = (filePath: string) => {
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
        ? (props: { lineNumber: number; annotationSide: "additions" | "deletions" }) => {
            onLineClick(filePath, props.lineNumber, props.annotationSide)
          }
        : undefined,
    }
  }

  if (files.length === 0) {
    return (
      <div
        data-slot="diff-viewer"
        className={cn(
          "flex h-full flex-1 items-center justify-center bg-background text-muted-foreground",
          className
        )}
      >
        No files to display
      </div>
    )
  }

  return (
    <div
      data-slot="diff-viewer"
      className={cn("min-h-0 flex-1 overflow-auto bg-background", className)}
    >
      <div className="flex flex-col gap-4 p-4">
        {files.map((file) => {
          const oldFile = toFileContents(
            file.oldPath ?? file.path,
            file.oldContent
          )
          const newFile = toFileContents(file.path, file.newContent)
          const lineAnnotations = toLineAnnotations(annotations, draftAnnotations, file.path)

          const isCollapsed = collapsedFiles.has(file.path)
          const isViewed = viewedFiles.has(file.path)

          return (
            <div
              key={file.path}
              data-file-path={file.path}
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
                      onClick={(event) => {
                        const hoveredLine = getHoveredLine()
                        if (hoveredLine == null) return
                        event.stopPropagation()
                        addDraftAnnotation(file.path, hoveredLine.side, hoveredLine.lineNumber)
                      }}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="size-3" />
                    </Button>
                  )}
                  renderAnnotation={(annotation) => {
                    const meta = annotation.metadata
                    if (!meta) return null

                    if (meta.type === "draft") {
                      const draftId = `draft-${meta.draft.filePath}-${meta.draft.side}-${meta.draft.lineNumber}`
                      const isSubmitting = submittingDrafts.has(draftId)
                      
                      return (
                        <InlineCommentForm
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
                          isSubmitting={isSubmitting}
                        />
                      )
                    }

                    // Render existing comment
                    const comment = meta.comment
                    return (
                      <div
                        data-annotation-line={annotation.lineNumber}
                        className="border-l-2 border-primary bg-muted/50 p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {comment.author.name}
                          </span>
                          {comment.severity && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-xs",
                                comment.severity === "critical" &&
                                  "bg-destructive text-destructive-foreground",
                                comment.severity === "warning" &&
                                  "bg-warning text-warning-foreground",
                                comment.severity === "info" &&
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {comment.severity}
                            </span>
                          )}
                        </div>
                        <Markdown className="mt-1">
                          {comment.content}
                        </Markdown>
                      </div>
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

/** Inline comment form for draft annotations */
interface InlineCommentFormProps {
  onSubmit: (content: string) => void
  onCancel: () => void
  isSubmitting?: boolean
}

function InlineCommentForm({ onSubmit, onCancel, isSubmitting = false }: InlineCommentFormProps) {
  const [content, setContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = useCallback(() => {
    if (content.trim() && !isSubmitting) {
      onSubmit(content.trim())
    }
  }, [content, isSubmitting, onSubmit])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleSubmit()
      } else if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel]
  )

  return (
    <div className="w-full overflow-hidden">
      <div className="m-4 max-w-[95%] sm:max-w-[70%]">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Leave a comment..."
            disabled={isSubmitting}
            rows={3}
            className="min-h-[60px] resize-none"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Comment"
              )}
            </Button>
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1">Cmd+Enter</kbd> to submit, <kbd className="rounded bg-muted px-1">Esc</kbd> to cancel
          </p>
        </div>
      </div>
    </div>
  )
}

export { Viewer }
