import { useDiffPanelContext } from './diff-panel-context'
import { DiffPanel } from './index'
import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary'
import { useAnnotations } from '@/hooks'
import { usePRContext } from '@/hooks'
import type { AIReviewItem } from '@/types/review'

interface DiffPanelViewerProps {
  aiReviewItems: AIReviewItem[]
}

/**
 * Diff viewer that consumes diff data, annotations, navigation refs,
 * and viewed-file state from DiffPanelContext. Owns annotation operations
 * and AI-to-draft conversion via useAnnotations.
 *
 * Intended as the center panel in MainLayout.
 */
export function DiffPanelViewerContainer({
  aiReviewItems,
}: DiffPanelViewerProps) {
  const { prNumber } = usePRContext()

  const {
    files,
    isDiffLoading,
    diffError,
    diffContainerRef,
    diffViewerRef,
    viewedFiles,
    syncingViewedFiles,
    setFileViewed,
  } = useDiffPanelContext()

  const {
    annotations,
    visibleAIReviewItems,
    convertingAIItemIds,
    isActionLoading,
    addDraft,
    editDraft,
    deleteDraft,
    replyTo,
    editComment,
    deleteComment,
    convertAIToDraft,
  } = useAnnotations({ aiReviewItems })

  return (
    <ErrorBoundary
      resetKeys={[prNumber]}
      fallback={
        <ErrorFallback
          title="Failed to load diff"
          description="There was an error loading the diff content."
          className="m-4"
        />
      }
    >
      <DiffPanel.Root ref={diffContainerRef}>
        {isDiffLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="animate-pulse">Loading diff...</span>
          </div>
        ) : diffError && files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <p className="text-destructive">Failed to load diff</p>
            <p className="text-sm text-muted-foreground">{diffError.message}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
            <p>No files to display</p>
          </div>
        ) : (
          <DiffPanel.Viewer
            ref={diffViewerRef}
            files={files}
            annotations={annotations}
            aiReviewItems={visibleAIReviewItems}
            onCommentSubmit={addDraft}
            onReplySubmit={replyTo}
            onEditDraft={editDraft}
            onDeleteDraft={deleteDraft}
            onEditReply={editComment}
            onDeleteReply={deleteComment}
            isDraftActionLoading={isActionLoading}
            onConvertAIToDraft={convertAIToDraft}
            convertingAIItemIds={convertingAIItemIds}
            viewedFiles={viewedFiles}
            onFileViewedChange={setFileViewed}
            syncingViewedFiles={syncingViewedFiles}
          />
        )}
      </DiffPanel.Root>
    </ErrorBoundary>
  )
}
