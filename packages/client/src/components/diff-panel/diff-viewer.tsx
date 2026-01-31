import { useState, useCallback } from "react"
import { MultiFileDiff, type DiffLineAnnotation, type FileContents } from "@pierre/diffs/react"
import { cn } from "@/lib/utils"
import type { ReviewComment } from "@/types/review"
import { CollapsibleFileHeader } from "./collapsible-file-header"

export interface DiffFileData {
  path: string
  oldPath?: string
  status: "added" | "modified" | "deleted" | "renamed"
  additions: number
  deletions: number
  oldContent: string
  newContent: string
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
}

function toFileContents(path: string, content: string): FileContents {
  return {
    name: path,
    contents: content,
  }
}

function toLineAnnotations(
  comments: ReviewComment[],
  filePath: string
): DiffLineAnnotation<ReviewComment>[] {
  return comments
    .filter((c) => c.filePath === filePath)
    .map((c) => ({
      side: "additions" as const,
      lineNumber: c.lineNumber,
      metadata: c,
    }))
}

function Viewer({
  files,
  annotations = [],
  onLineClick,
  className,
  onFileViewedChange,
  viewedFiles: controlledViewedFiles,
}: DiffPanelViewerProps) {
  // Track collapsed state for each file
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  
  // Internal viewed files state (used when not controlled)
  const [internalViewedFiles, setInternalViewedFiles] = useState<Set<string>>(new Set())
  
  // Use controlled state if provided, otherwise use internal state
  const viewedFiles = controlledViewedFiles ?? internalViewedFiles

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

  const createDiffOptions = (filePath: string) =>
    ({
      diffStyle: "split",
      expandUnchanged: false,
      expansionLineCount: 20,
      lineDiffType: "word",
      hunkSeparators: "line-info",
      disableFileHeader: true, // Disable default header to use our custom one
      onLineClick: onLineClick
        ? (props: { lineNumber: number; annotationSide: "additions" | "deletions" }) => {
            onLineClick(filePath, props.lineNumber, props.annotationSide)
          }
        : undefined,
    }) as const

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
          const lineAnnotations = toLineAnnotations(annotations, file.path)

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
                <MultiFileDiff<ReviewComment>
                  oldFile={oldFile}
                  newFile={newFile}
                  options={createDiffOptions(file.path)}
                  lineAnnotations={lineAnnotations}
                  renderAnnotation={(annotation) => (
                    <div
                      data-annotation-line={annotation.lineNumber}
                      className="border-l-2 border-primary bg-muted/50 p-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {annotation.metadata?.author.name}
                        </span>
                        {annotation.metadata?.severity && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-xs",
                              annotation.metadata.severity === "critical" &&
                                "bg-destructive text-destructive-foreground",
                              annotation.metadata.severity === "warning" &&
                                "bg-warning text-warning-foreground",
                              annotation.metadata.severity === "info" &&
                                "bg-muted text-muted-foreground"
                            )}
                          >
                            {annotation.metadata.severity}
                          </span>
                        )}
                      </div>
                      <p className="mt-1">{annotation.metadata?.content}</p>
                    </div>
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { Viewer }
