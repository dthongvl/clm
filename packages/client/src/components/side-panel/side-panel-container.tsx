import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  SidePanel,
  SidePanelGroupingContent,
  SidePanelAIReviewContent,
  SidePanelRelatedFilesContent,
  IntelligentGrouping,
  AIReviewSummary,
  RelatedFiles,
  ActionTriggerWithContext,
} from '@/components/side-panel'
import { PatternVerificationPanel } from '@/components/side-panel/pattern-verification'
import { ActionSettingsPopover } from '@/components/side-panel/action-settings-popover'
import { useDiffPanelContext } from '@/components/diff-panel/diff-panel-context'
import { useAIReview, useRelatedFiles, useModels, useSettings, usePRContext } from '@/hooks'
import { usePatternVerification } from '@/hooks/use-pattern-verification'
import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary'
import { AiGenerativeIcon } from '@hugeicons/core-free-icons'

/**
 * Container for the right side panel — owns all AI action hooks
 * (grouping, AI review, related files, pattern verification).
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

  const {
    files: relatedFiles,
    findFiles: findRelatedFiles,
    isLoading: isLoadingRelatedFiles,
    error: relatedFilesError,
  } = useRelatedFiles()

  const {
    result: verificationResult,
    isLoading: isVerifying,
    error: verificationError,
    verify: verifyPatterns,
  } = usePatternVerification()

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
              isLoading={isReviewLoading}
              icon={AiGenerativeIcon}
              onRun={triggerReview}
              enableAIReviewOptions
            />
            <ActionSettingsPopover
              actionKey="ai-review"
              models={models}
              currentModel={settings?.["ai-review"]?.model}
              currentVariant={settings?.["ai-review"]?.variant}
              onModelChange={(model, variant) => updateActionModel("ai-review", model, variant)}
            />
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            AI analyzes the diff and surfaces potential issues by severity — click any issue to jump directly to the relevant line. Pattern Verification checks whether all related code locations were consistently updated.
          </p>
          <AIReviewSummary
            items={aiReviewItems}
            onItemClick={(item) => {
              scrollToAnnotation(item.filePath, item.lineNumber)
            }}
          />
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-sm font-medium mb-3">Pattern Verification</h3>
            <PatternVerificationPanel
              result={verificationResult}
              isLoading={isVerifying}
              error={verificationError}
              onVerify={verifyPatterns}
              onLocationClick={(filePath, lineNumber) => {
                scrollToAnnotation(filePath, lineNumber)
              }}
              models={models}
              currentModel={settings?.["pattern-verification"]?.model}
              currentVariant={settings?.["pattern-verification"]?.variant}
              onModelChange={(model, variant) => updateActionModel("pattern-verification", model, variant)}
            />
          </div>
        </SidePanelAIReviewContent>
        <SidePanelRelatedFilesContent>
          <RelatedFiles
            files={relatedFiles}
            onFileClick={scrollToFile}
            onFindFiles={findRelatedFiles}
            isLoading={isLoadingRelatedFiles}
            error={relatedFilesError}
            models={models}
            currentModel={settings?.["related-files"]?.model}
            currentVariant={settings?.["related-files"]?.variant}
            onModelChange={(model, variant) => updateActionModel("related-files", model, variant)}
          />
        </SidePanelRelatedFilesContent>
      </SidePanel>
    </ErrorBoundary>
  )
}
