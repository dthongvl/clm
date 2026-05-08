import { memo, useCallback, useMemo } from "react"
import {
  MultiFileDiff,
  type DiffLineAnnotation,
  type FileContents,
  type AnnotationSide,
  type VirtualFileMetrics,
} from "@pierre/diffs/react"
import type { SelectedLineRange } from "@pierre/diffs"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { AnnotationRenderer } from "./annotation-renderer"
import type { DiffFileData } from "@/types/diff"
import type { AnnotationMetadata } from "./diff-viewer"

function toFileContents(path: string, content: string): FileContents {
  return { name: path, contents: content }
}

/** Metrics tuned to our Tailwind layout for accurate virtualizer estimates. */
const FILE_DIFF_METRICS: VirtualFileMetrics = {
  lineHeight: 20,
  hunkLineCount: 20,
  diffHeaderHeight: 44,
  hunkSeparatorHeight: 32,
  fileGap: 16,
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
  onEditReply?: (commentId: string, content: string) => Promise<void>
  onDeleteReply?: (commentId: string) => Promise<void>
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
  onEditReply,
  onDeleteReply,
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

  const handleLineSelectionEnd = useCallback(
    (range: SelectedLineRange | null) => {
      if (range == null) return
      const derivedSide = range.endSide ?? range.side
      const side: AnnotationSide =
        derivedSide === "deletions" ? "deletions" : "additions"
      onAddDraft(file.path, side, Math.max(range.end, range.start))
    },
    [file.path, onAddDraft]
  )

  const options = useMemo(() => ({
    diffStyle: "split" as const,
    expandUnchanged: false,
    expansionLineCount: 20,
    lineDiffType: "word" as const,
    hunkSeparators: "line-info-basic" as const,
    collapsed: isCollapsed,
    enableGutterUtility: !hasOpenCommentForm,
    enableLineSelection: !hasOpenCommentForm,
    onLineSelectionEnd: handleLineSelectionEnd,
    theme: { dark: "pierre-dark", light: "pierre-light" } as const,
    themeType: resolvedTheme,
    onLineClick: onLineClick
      ? (lineProps: { lineNumber: number; annotationSide: "additions" | "deletions" }) => {
          onLineClick(file.path, lineProps.lineNumber, lineProps.annotationSide)
        }
      : undefined,
  }), [isCollapsed, hasOpenCommentForm, resolvedTheme, onLineClick, file.path, handleLineSelectionEnd])

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

  return (
    <div
      role="listitem"
      data-file-path={file.path}
      data-state={isCollapsed ? "collapsed" : "expanded"}
      data-viewed={isViewed}
    >
      <MultiFileDiff<AnnotationMetadata>
        oldFile={oldFile}
        newFile={newFile}
        options={options}
        metrics={FILE_DIFF_METRICS}
        lineAnnotations={lineAnnotations}
        className="overflow-clip rounded-lg border border-border"
        renderCustomHeader={(fileDiff) => (
          <CollapsibleFileHeader
            fileDiff={fileDiff}
            isCollapsed={isCollapsed}
            isViewed={isViewed}
            isSyncingViewed={isSyncingViewed}
            onToggleCollapse={handleToggleCollapse}
            onToggleViewed={handleToggleViewed}
            onViewSource={handleViewSource}
          />
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
            onEditReply={onEditReply}
            onDeleteReply={onDeleteReply}
            isDraftActionLoading={isDraftActionLoading}
            onConvertAIToDraft={onConvertAIToDraft}
            convertingAIItemIds={convertingAIItemIds}
          />
        )}
      />
    </div>
  )
})
