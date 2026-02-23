import { memo, useCallback, useMemo } from "react"
import {
  MultiFileDiff,
  type DiffLineAnnotation,
  type FileContents,
  type AnnotationSide,
} from "@pierre/diffs/react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { AnnotationRenderer } from "./annotation-renderer"
import type { DiffFileData } from "@/types/diff"
import type { AnnotationMetadata } from "./diff-viewer"

function toFileContents(path: string, content: string): FileContents {
  return { name: path, contents: content }
}

interface FileDiffCardProps {
  file: DiffFileData
  lineAnnotations: DiffLineAnnotation<AnnotationMetadata>[]
  isCollapsed: boolean
  isViewed: boolean
  isSyncingViewed?: boolean
  resolvedTheme: "dark" | "light"
  hasOpenCommentForm: boolean
  submittingDrafts: Set<string>
  submittingReplies: Set<string>
  onToggleCollapse: (filePath: string) => void
  onToggleViewed: (filePath: string) => void
  onAddDraft: (filePath: string, side: AnnotationSide, lineNumber: number) => void
  onSubmitDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
    content: string
  ) => Promise<void>
  onCancelDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number
  ) => void
  onSubmitReply?: (commentId: string, content: string) => Promise<void>
  onEditDraft?: (commentId: string, content: string) => Promise<void>
  onDeleteDraft?: (commentId: string) => Promise<void>
  isDraftActionLoading?: boolean
  onLineClick?: (
    filePath: string,
    line: number,
    side: "additions" | "deletions"
  ) => void
  onConvertAIToDraft?: (itemId: string) => Promise<void>
  convertingAIItemIds?: Set<string>
  onViewHeadFile?: (payload: { filePath: string; content: string }) => void
}

export const FileDiffCard = memo(function FileDiffCard({
  file,
  lineAnnotations,
  isCollapsed,
  isViewed,
  isSyncingViewed,
  resolvedTheme,
  hasOpenCommentForm,
  submittingDrafts,
  submittingReplies,
  onToggleCollapse,
  onToggleViewed,
  onAddDraft,
  onSubmitDraft,
  onCancelDraft,
  onSubmitReply,
  onEditDraft,
  onDeleteDraft,
  isDraftActionLoading,
  onLineClick,
  onConvertAIToDraft,
  convertingAIItemIds,
  onViewHeadFile,
}: FileDiffCardProps) {
  const oldFile = useMemo(
    () => toFileContents(file.oldPath ?? file.path, file.oldContent),
    [file.oldPath, file.path, file.oldContent]
  )
  const newFile = useMemo(
    () => toFileContents(file.path, file.newContent),
    [file.path, file.newContent]
  )

  const options = useMemo(() => ({
    diffStyle: "split" as const,
    expandUnchanged: false,
    expansionLineCount: 20,
    lineDiffType: "word" as const,
    hunkSeparators: "line-info" as const,
    disableFileHeader: true,
    enableHoverUtility: !hasOpenCommentForm,
    themeType: resolvedTheme,
    onLineClick: onLineClick
      ? (lineProps: { lineNumber: number; annotationSide: "additions" | "deletions" }) => {
          onLineClick(file.path, lineProps.lineNumber, lineProps.annotationSide)
        }
      : undefined,
  }), [hasOpenCommentForm, resolvedTheme, onLineClick, file.path])

  const handleToggleCollapse = useCallback(
    () => onToggleCollapse(file.path),
    [onToggleCollapse, file.path]
  )

  const handleToggleViewed = useCallback(
    () => onToggleViewed(file.path),
    [onToggleViewed, file.path]
  )

  const handleViewSource = useCallback(() => {
    onViewHeadFile?.({ filePath: file.path, content: file.newContent })
  }, [onViewHeadFile, file.path, file.newContent])

  // Disable content-visibility optimization when there are annotations to prevent layout jumping
  // when annotations are added/removed (e.g., submitting a comment then clicking + to add another)
  const hasAnnotations = lineAnnotations.length > 0

  return (
    <div
      role="listitem"
      data-file-path={file.path}
      data-state={isCollapsed ? "collapsed" : "expanded"}
      data-viewed={isViewed}
      className="overflow-clip rounded-lg border border-border"
      style={{ contentVisibility: "auto", containIntrinsicBlockSize: hasAnnotations ? "auto 800px" : "auto 500px" }}
    >
      <CollapsibleFileHeader
        filePath={file.path}
        status={file.status}
        additions={file.additions}
        deletions={file.deletions}
        isCollapsed={isCollapsed}
        isViewed={isViewed}
        isSyncingViewed={isSyncingViewed}
        onToggleCollapse={handleToggleCollapse}
        onToggleViewed={handleToggleViewed}
        canViewSource={file.status !== "deleted"}
        onViewSource={handleViewSource}
      />

      {!isCollapsed && (
        <MultiFileDiff<AnnotationMetadata>
          oldFile={oldFile}
          newFile={newFile}
          options={options}
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
                onAddDraft(file.path, hoveredLine.side, hoveredLine.lineNumber)
              }}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3" aria-hidden="true" />
            </Button>
          )}
          renderAnnotation={(annotation) => (
            <AnnotationRenderer
              annotation={annotation}
              submittingDrafts={submittingDrafts}
              submittingReplies={submittingReplies}
              onSubmitDraft={onSubmitDraft}
              onCancelDraft={onCancelDraft}
              onSubmitReply={onSubmitReply}
              onEditDraft={onEditDraft}
              onDeleteDraft={onDeleteDraft}
              isDraftActionLoading={isDraftActionLoading}
              onConvertAIToDraft={onConvertAIToDraft}
              convertingAIItemIds={convertingAIItemIds}
            />
          )}
        />
      )}
    </div>
  )
})
