import { useState, useCallback } from "react"
import { AiGenerativeIcon } from "@hugeicons/core-free-icons"
import { useDiffPanelContext } from "@/components/diff-panel/diff-panel-context"
import {
  useStreamingReviewGuide,
  useReviewGuideState,
  useOffRoute,
  useModels,
  useSettings,
} from "@/hooks"
import { ActionTriggerWithContext } from "../action-trigger-with-context"
import { ActionSettingsPopover } from "../action-settings-popover"
import { AIProgressPanel } from "../ai-progress-panel"
import { Button } from "@/components/ui/button"
import { Stepper } from "./stepper"
import { RegenerateModal } from "./regenerate-modal"
import { StepCard } from "./step-card"
import { JudgmentThreadList } from "./judgment-thread-list"
import { AiSourceBadge } from "./ai-source-badge"
import type { RegenerationPreview } from "@/hooks"

/**
 * Root for the Review Guide tab. Owns the streaming hook, state hook,
 * regeneration confirmation modal, and CTA / progress / stepper switch.
 */
function Root() {
  const streaming = useStreamingReviewGuide()
  const guideState = useReviewGuideState()
  const { isOffRoute } = useOffRoute()
  const { scrollToFile, scrollToAnnotation, focusFileGroup } =
    useDiffPanelContext()
  const { data: models = [] } = useModels()
  const { settings, updateActionModel } = useSettings()

  const [regenerationPreview, setRegenerationPreview] =
    useState<RegenerationPreview | null>(null)

  const isStreaming = streaming.status === "streaming"
  const hasGuide = guideState.guide !== null

  const handleStart = useCallback(
    async (additionalContext?: string) => streaming.start(additionalContext),
    [streaming]
  )

  const handleRequestRegenerate = useCallback(() => {
    setRegenerationPreview(guideState.prepareRegeneration())
  }, [guideState])

  const handleConfirmRegenerate = useCallback(async () => {
    setRegenerationPreview(null)
    await streaming.start()
  }, [streaming])

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        AI synthesizes a PR overview, an ordered route through the changes, and
        flags lines that need your judgment.
      </p>

      <div className="mb-3 flex gap-2">
        <ActionTriggerWithContext
          label={hasGuide ? "Regenerate Guide" : "Generate Review Guide"}
          loadingLabel="Generating Guide..."
          ariaLabel="Generate review guide"
          isLoading={isStreaming}
          disabled={isStreaming}
          icon={AiGenerativeIcon}
          onRun={hasGuide ? async () => {
            handleRequestRegenerate()
            return true
          } : handleStart}
        />
        <ActionSettingsPopover
          actionKey="review-guide"
          models={models}
          currentModel={settings?.["review-guide"]?.model}
          currentVariant={settings?.["review-guide"]?.variant}
          onModelChange={(model, variant) =>
            updateActionModel("review-guide", model, variant)
          }
        />
      </div>

      {streaming.status !== "idle" && (
        <div className="mb-3">
          <AIProgressPanel
            status={streaming.status}
            phase={streaming.phase}
            activities={streaming.activities}
            error={streaming.error}
            onCancel={streaming.cancel}
          />
        </div>
      )}

      {streaming.status === "error" && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <span className="text-sm font-medium text-destructive">
            Failed to generate review guide
          </span>
          {streaming.error && (
            <p className="text-xs text-muted-foreground">{streaming.error}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => handleStart()}
          >
            Try again
          </Button>
        </div>
      )}

      {hasGuide && guideState.guide && (
        <Stepper
          guide={guideState.guide}
          reviewedStepIds={guideState.reviewedStepIds}
          currentStepId={guideState.currentStepId}
          threads={guideState.threads}
          isOffRoute={isOffRoute}
          onSetCurrentStep={guideState.setCurrentStep}
          onMarkReviewed={guideState.markStepReviewed}
          onUnmarkReviewed={guideState.unmarkStepReviewed}
          onFocusFileGroup={focusFileGroup}
          onFileClick={scrollToFile}
          onJudgmentLineClick={scrollToAnnotation}
          onPinThread={guideState.pinThread}
          onUnpinThread={guideState.unpinThread}
          onResolveThread={guideState.resolveThread}
          onUnresolveThread={guideState.unresolveThread}
          onReplyToThread={guideState.replyToThread}
        />
      )}

      {!hasGuide && streaming.status === "idle" && (
        <p className="text-xs text-muted-foreground">
          No guide yet. Click "Generate Review Guide" to produce a recommended
          reading route.
        </p>
      )}

      <RegenerateModal
        open={regenerationPreview !== null}
        onOpenChange={(open) => {
          if (!open) setRegenerationPreview(null)
        }}
        unresolvedDiscardedCount={regenerationPreview?.unresolvedDiscardedCount ?? 0}
        pinnedPreservedThreads={regenerationPreview?.pinnedPreservedThreads ?? []}
        onConfirm={handleConfirmRegenerate}
        isRegenerating={isStreaming}
      />
    </>
  )
}

const ReviewGuide = {
  Root,
  Stepper,
  StepCard,
  JudgmentThreadList,
  RegenerateModal,
  AiSourceBadge,
}

export { ReviewGuide }
export { AiSourceBadge } from "./ai-source-badge"
