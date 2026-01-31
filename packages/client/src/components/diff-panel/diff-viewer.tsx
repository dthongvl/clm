import { MultiFileDiff, type DiffLineAnnotation, type FileContents } from "@pierre/diffs/react"
import { cn } from "@/lib/utils"
import type { ReviewComment } from "@/types/review"

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
}: DiffPanelViewerProps) {
  const createDiffOptions = (filePath: string) =>
    ({
      diffStyle: "split",
      expandUnchanged: true,
      expansionLineCount: 20,
      lineDiffType: "word",
      hunkSeparators: "line-info",
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

          return (
            <div
              key={file.path}
              data-file-path={file.path}
              className="overflow-hidden rounded-lg border border-border"
            >
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
                renderHeaderMetadata={() => (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5",
                        file.status === "added" &&
                          "bg-green-500/20 text-green-600",
                        file.status === "deleted" &&
                          "bg-red-500/20 text-red-600",
                        file.status === "modified" &&
                          "bg-blue-500/20 text-blue-600",
                        file.status === "renamed" &&
                          "bg-yellow-500/20 text-yellow-600"
                      )}
                    >
                      {file.status}
                    </span>
                    <span className="text-green-500">+{file.additions}</span>
                    <span className="text-red-500">−{file.deletions}</span>
                  </div>
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { Viewer }
