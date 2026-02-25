import { useMemo, useEffect } from "react"
import { toast } from "sonner"
import { TopBar } from "@/components/top-bar"
import { MainLayout } from "@/components/main-layout"
import { DiffPanel } from "@/components/diff-panel"
import {
  SidePanel,
  SidePanelGroupingContent,
  SidePanelAIReviewContent,
  SidePanelRelatedFilesContent,
  IntelligentGrouping,
  AIReviewSummary,
  RelatedFiles,
  ActionTriggerWithContext,
} from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import { AiGenerativeIcon } from "@hugeicons/core-free-icons"

import { ModeToggle } from "@/components/mode-toggle"
import { useAIReview, usePR, useDiff, useComments, usePRContext, useRelatedFiles, useModels, useSettings, useViewedFiles } from "@/hooks"
import { usePatternVerification } from "@/hooks/use-pattern-verification"
import { useDiffNavigation } from "@/hooks/use-diff-navigation"
import { useRefresh } from "@/hooks/use-refresh"
import { useDraftActions } from "@/hooks/use-draft-actions"
import { useAIConversion } from "@/hooks/use-ai-conversion"
import { PatternVerificationPanel } from "@/components/side-panel/pattern-verification"
import { ActionSettingsPopover } from "@/components/side-panel/action-settings-popover"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"

export function App() {
  const { prNumber } = usePRContext()

  const { pr, isLoading: isPRLoading, error: prError } = usePR()
  const { files, isLoading: isDiffLoading, error: diffError } = useDiff()
  const { comments, isLoading: isCommentsLoading } = useComments()

  const {
    diffContainerRef,
    diffViewerRef,
    selectedFilePath,
    scrollToFile,
    scrollToAnnotation,
    handleFileTreeSelect,
  } = useDiffNavigation()

  const { isRefreshing, handleRefresh } = useRefresh()

  const {
    draftComments,
    draftCount,
    isDraftActionLoading,
    addDraftComment,
    handleCommentSubmit,
    handleEditDraft,
    handleDeleteDraft,
    handleSubmitReview,
    handleReplySubmit,
    handleEditReply,
    handleDeleteReply,
  } = useDraftActions()

  const {
    viewedFiles,
    syncingFiles: syncingViewedFiles,
    setViewed: setFileViewed,
  } = useViewedFiles()

  const {
    groups,
    generateGroups,
    isGeneratingGroups,
    error: groupingError,
    items: aiReviewItems,
    triggerReview,
    isLoading: isReviewLoading,
  } = useAIReview({
    autoGenerate: false,
  })

  const {
    visibleAIReviewItems,
    convertingAIItemIds,
    handleConvertAIToDraft,
  } = useAIConversion(aiReviewItems, addDraftComment)

  const {
    files: relatedFiles,
    findFiles: findRelatedFiles,
    isLoading: isLoadingRelatedFiles,
    error: relatedFilesError,
  } = useRelatedFiles({
    autoGenerate: false,
  })

  const {
    result: verificationResult,
    isLoading: isVerifying,
    error: verificationError,
    verify: verifyPatterns,
  } = usePatternVerification()

  const { models, error: modelsError } = useModels()
  const { settings, updateActionModel, error: settingsError } = useSettings()

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

  const annotations = useMemo(
    () => [...comments, ...draftComments],
    [comments, draftComments]
  )

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <MainLayout
        className="h-full"
        header={
          <TopBar.Root>
            {isPRLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="animate-pulse">Loading PR info...</span>
              </div>
            ) : prError && !pr ? (
              <div className="flex items-center gap-2 text-destructive">
                <span>Failed to load PR: {prError.message}</span>
              </div>
            ) : pr ? (
              <TopBar.PRInfo pr={pr} />
            ) : null}
            <TopBar.Actions>
              <TopBar.SubmitReviewDialog
                draftCount={draftCount}
                onSubmit={handleSubmitReview}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isPRLoading || isDiffLoading || isCommentsLoading}
              >
                {isRefreshing ? "Fetching branches..." : isPRLoading || isDiffLoading || isCommentsLoading ? "Loading..." : "Refresh"}
              </Button>
              <Button variant="outline" size="sm">
                Settings
              </Button>
              <ModeToggle />
            </TopBar.Actions>
          </TopBar.Root>
        }
        leftPanel={
          <DiffPanel.PRFileTree
            files={files}
            selectedPath={selectedFilePath}
            onSelectFile={handleFileTreeSelect}
            className="h-full"
          />
        }
        centerPanel={
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
                  onCommentSubmit={handleCommentSubmit}
                  onReplySubmit={handleReplySubmit}
                  onEditDraft={handleEditDraft}
                  onDeleteDraft={handleDeleteDraft}
                  onEditReply={handleEditReply}
                  onDeleteReply={handleDeleteReply}
                  isDraftActionLoading={isDraftActionLoading}
                  onConvertAIToDraft={handleConvertAIToDraft}
                  convertingAIItemIds={convertingAIItemIds}
                  viewedFiles={viewedFiles}
                  onFileViewedChange={setFileViewed}
                  syncingViewedFiles={syncingViewedFiles}
                />
              )}
            </DiffPanel.Root>
          </ErrorBoundary>
        }
        rightPanel={
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
                <AIReviewSummary
                  items={visibleAIReviewItems}
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
        }
      />
    </div>
  )
}

export default App
