import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  SidePanel,
  SidePanelGroupingContent,
  SidePanelAIReviewContent,
  IntelligentGrouping,
  AIReviewSummary,
  ActionTriggerWithContext,
} from '@/components/side-panel'
import { ActionSettingsPopover } from '@/components/side-panel/action-settings-popover'
import { AIProgressPanel } from '@/components/side-panel/ai-progress-panel'
import { useDiffPanelContext } from '@/components/diff-panel/diff-panel-context'
import { useAIReview, useModels, useSettings, usePRContext } from '@/hooks'
import {
  STREAMING_REVIEW_ENABLED,
  useStreamingReview,
} from '@/hooks/use-ai-review'
import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary'
import { AiGenerativeIcon } from '@hugeicons/core-free-icons'

/**
 * Container for the right side panel — owns all AI action hooks
 * (grouping, AI review).
 *
 * Consumes DiffPanelContext for scroll-to-file/annotation cross-communication.
 */
export function SidePanelContainer() {
  const { prNumber } = usePRContext()

  const {
    groups,
    generateGroups,
    isGeneratingGroups,
    error: groupingError,
    items: aiReviewItems,
    triggerReview,
    isLoading: isReviewLoading,
  } = useAIReview()

  const streamingReview = useStreamingReview()
  const isStreamingActive = streamingReview.status === 'streaming'

  const runReview = useCallback(
    (additionalContext?: string) =>
      STREAMING_REVIEW_ENABLED
        ? streamingReview.start(additionalContext)
        : triggerReview(additionalContext),
    [streamingReview, triggerReview],
  )

  const { data: models = [], error: modelsError } = useModels()
  const { settings, updateActionModel, error: settingsError } = useSettings()

  const { scrollToFile, scrollToAnnotation } = useDiffPanelContext()

  useEffect(() => {
    if (settingsError) {
      toast.error("Failed to load settings", {
        description: settingsError.message,
      })
    }
  }, [settingsError])

  useEffect(() => {
    if (modelsError) {
      toast.error("Failed to load models", {
        description: modelsError.message,
      })
    }
  }, [modelsError])

  return (
    <ErrorBoundary
      resetKeys={[prNumber]}
      fallback={
        <ErrorFallback
          title="Failed to load panel"
          description="There was an error loading the side panel."
          className="m-4"
        />
      }
    >
      <SidePanel className="h-full">
        <SidePanelGroupingContent>
          <IntelligentGrouping
            groups={groups}
            onFileClick={scrollToFile}
            onGenerateGroups={generateGroups}
            isGenerating={isGeneratingGroups}
            error={groupingError}
            models={models}
            currentModel={settings?.grouping?.model}
            currentVariant={settings?.grouping?.variant}
            onModelChange={(model, variant) => updateActionModel("grouping", model, variant)}
          />
        </SidePanelGroupingContent>
        <SidePanelAIReviewContent>
          <div className="mb-4 flex gap-2">
            <ActionTriggerWithContext
              label="Generate AI Review"
              loadingLabel="Generating AI Review..."
              ariaLabel="Generate AI review"
              isLoading={isReviewLoading || isStreamingActive}
              icon={AiGenerativeIcon}
              onRun={runReview}
            />
            <ActionSettingsPopover
              actionKey="ai-review"
              models={models}
              currentModel={settings?.["ai-review"]?.model}
              currentVariant={settings?.["ai-review"]?.variant}
              onModelChange={(model, variant) => updateActionModel("ai-review", model, variant)}
            />
          </div>
          {STREAMING_REVIEW_ENABLED && streamingReview.status !== 'idle' && (
            <div className="mb-4">
              <AIProgressPanel
                status={streamingReview.status}
                phase={streamingReview.phase}
                thinking={streamingReview.thinking}
                toolCalls={streamingReview.toolCalls}
                error={streamingReview.error}
                onCancel={streamingReview.cancel}
              />
            </div>
          )}
          <p className="mb-4 text-xs text-muted-foreground">
            AI analyzes the diff and surfaces potential issues by severity — click any issue to jump directly to the relevant line.
          </p>
          <AIReviewSummary
            items={aiReviewItems}
            onItemClick={(item) => {
              scrollToAnnotation(item.filePath, item.lineNumber)
            }}
          />

        </SidePanelAIReviewContent>
      </SidePanel>
    </ErrorBoundary>
  )
}
