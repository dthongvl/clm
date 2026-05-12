import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  SidePanel,
  SidePanelDescriptionContent,
  SidePanelGroupingContent,
  SidePanelAIReviewContent,
  IntelligentGrouping,
  AIReviewSummary,
  ActionTriggerWithContext,
  PRDescription,
} from '@/components/side-panel'
import { ActionSettingsPopover } from '@/components/side-panel/action-settings-popover'
import { AIProgressPanel } from '@/components/side-panel'
import { useDiffPanelContext } from '@/components/diff-panel/diff-panel-context'
import { useAIReview, useModels, usePR, useSettings, usePRContext } from '@/hooks'
import {
  useStreamingGrouping,
  useStreamingReview,
} from '@/hooks/use-ai-review'
import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary'
import { AiGenerativeIcon } from '@hugeicons/core-free-icons'

/**
 * Container for the right side panel — owns the grouping and AI review action
 * hooks. The Notebook reading surface lives in the center panel and is no
 * longer mounted here.
 *
 * Consumes DiffPanelContext for scroll-to-file/annotation cross-communication.
 */
export function SidePanelContainer() {
  const { prNumber } = usePRContext()

  const { data: pr, isLoading: isPRLoading, error: prError } = usePR()

  const { groups, items: aiReviewItems } = useAIReview()

  const streamingReview = useStreamingReview()
  const isReviewStreamingActive = streamingReview.status === 'streaming'

  const streamingGrouping = useStreamingGrouping()
  const isGroupingStreamingActive = streamingGrouping.status === 'streaming'

  const { data: models = [], error: modelsError } = useModels()
  const { settings, updateActionModel, updateActionThinkingLevel, error: settingsError } = useSettings()

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
        <SidePanelDescriptionContent>
          <PRDescription
            pr={pr}
            isLoading={isPRLoading}
            error={prError as Error | null}
          />
        </SidePanelDescriptionContent>
        <SidePanelGroupingContent>
          <p className="mb-3 text-xs text-muted-foreground">
            AI organizes your PR's file changes into logical groups — making large PRs easier to navigate by showing related changes together instead of a flat file list.
          </p>
          <div className="mb-3 flex gap-2">
            <ActionTriggerWithContext
              label={groups.length > 0 ? "Regenerate Groupings" : "Generate AI Groupings"}
              loadingLabel="Generating Groupings..."
              ariaLabel="Generate AI groupings"
              disabled={isGroupingStreamingActive}
              icon={AiGenerativeIcon}
              onRun={streamingGrouping.start}
            />
            <ActionSettingsPopover
              actionKey="grouping"
              models={models}
              currentModel={settings?.grouping?.model}
              currentVariant={settings?.grouping?.variant}
              currentThinkingLevel={settings?.grouping?.thinkingLevel}
              onModelChange={(model, variant) => updateActionModel("grouping", model, variant)}
              onThinkingLevelChange={(level) => updateActionThinkingLevel("grouping", level)}
            />
          </div>
          {streamingGrouping.status !== 'idle' && (
            <div className="mb-3">
              <AIProgressPanel
                status={streamingGrouping.status}
                phase={streamingGrouping.phase}
                activities={streamingGrouping.activities}
                error={streamingGrouping.error}
                onCancel={streamingGrouping.cancel}
              />
            </div>
          )}
          <IntelligentGrouping
            groups={groups}
            onFileClick={scrollToFile}
            isGenerating={isGroupingStreamingActive}
          />
        </SidePanelGroupingContent>
        <SidePanelAIReviewContent>
          <p className="mb-3 text-xs text-muted-foreground">
            AI analyzes the diff and surfaces potential issues by severity — click any issue to jump directly to the relevant line.
          </p>
          <div className="mb-3 flex gap-2">
            <ActionTriggerWithContext
              label="Generate AI Review"
              loadingLabel="Generating AI Review..."
              ariaLabel="Generate AI review"
              disabled={isReviewStreamingActive}
              icon={AiGenerativeIcon}
              onRun={streamingReview.start}
            />
            <ActionSettingsPopover
              actionKey="ai-review"
              models={models}
              currentModel={settings?.["ai-review"]?.model}
              currentVariant={settings?.["ai-review"]?.variant}
              currentThinkingLevel={settings?.["ai-review"]?.thinkingLevel}
              onModelChange={(model, variant) => updateActionModel("ai-review", model, variant)}
              onThinkingLevelChange={(level) => updateActionThinkingLevel("ai-review", level)}
            />
          </div>
          {streamingReview.status !== 'idle' && (
            <div className="mb-3">
              <AIProgressPanel
                status={streamingReview.status}
                phase={streamingReview.phase}
                activities={streamingReview.activities}
                error={streamingReview.error}
                onCancel={streamingReview.cancel}
              />
            </div>
          )}
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
