import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"
import { useDiffPanelContext } from "@/components/diff-panel/diff-panel-context"
import { useAIReview, useModels, usePRContext, useSettings } from "@/hooks"
import {
  useStreamingGrouping,
  useStreamingReview,
} from "@/hooks/use-ai-review"
import {
  IntelligentGrouping,
  AIReviewSummary,
  ActionTriggerWithContext,
  AIProgressPanel,
} from "@/components/side-panel"
import { ActionSettingsPopover } from "@/components/side-panel/action-settings-popover"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiGenerativeIcon, Layers01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"

type RightTabValue = "grouping" | "ai-review"

export function RightPanelContainer() {
  const { prNumber } = usePRContext()

  const { groups, items: aiReviewItems } = useAIReview()

  const streamingReview = useStreamingReview()
  const isReviewStreamingActive = streamingReview.status === "streaming"

  const streamingGrouping = useStreamingGrouping()
  const isGroupingStreamingActive = streamingGrouping.status === "streaming"

  const { data: models = [], error: modelsError } = useModels()
  const { settings, updateActionModel, updateActionThinkingLevel, error: settingsError } = useSettings()

  const { scrollToFile, scrollToAnnotation } = useDiffPanelContext()

  const [tab, setTab] = useState<RightTabValue>(() =>
    getStorageItem<RightTabValue>(StorageKeys.RIGHT_PANEL_TAB, "grouping")
  )

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as RightTabValue
    setTab(newTab)
    setStorageItem(StorageKeys.RIGHT_PANEL_TAB, newTab)
  }, [])

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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 w-[calc(100%-1rem)]">
            <TabsTrigger value="grouping">
              <HugeiconsIcon icon={Layers01Icon} />
              Grouping
            </TabsTrigger>
            <TabsTrigger value="ai-review">
              <HugeiconsIcon icon={SparklesIcon} />
              AI Review
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="grouping"
            className="min-h-0 flex-1 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  AI organizes your PR&apos;s file changes into logical groups —
                  making large PRs easier to navigate by showing related changes
                  together instead of a flat file list.
                </p>
                <div className="mb-3 flex gap-2">
                  <ActionTriggerWithContext
                    label={
                      groups.length > 0
                        ? "Regenerate Groupings"
                        : "Generate AI Groupings"
                    }
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
                    onModelChange={(model, variant) =>
                      updateActionModel("grouping", model, variant)
                    }
                    onThinkingLevelChange={(level) =>
                      updateActionThinkingLevel("grouping", level)
                    }
                  />
                </div>
                {streamingGrouping.status !== "idle" && (
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
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent
            value="ai-review"
            className="min-h-0 flex-1 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  AI analyzes the diff and surfaces potential issues by severity
                  — click any issue to jump directly to the relevant line.
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
                    onModelChange={(model, variant) =>
                      updateActionModel("ai-review", model, variant)
                    }
                    onThinkingLevelChange={(level) =>
                      updateActionThinkingLevel("ai-review", level)
                    }
                  />
                </div>
                {streamingReview.status !== "idle" && (
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
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  )
}
