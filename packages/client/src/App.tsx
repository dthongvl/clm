import { useRef, useCallback, useState, useMemo, useEffect } from "react"
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
} from "@/components/side-panel"
import { Button } from "@/components/ui/button"

import { ModeToggle } from "@/components/mode-toggle"
import { useAIReview, usePR, useDiff, useComments, useDraftComments, usePRContext, useRelatedFiles, useModels, useSettings, useViewedFiles } from "@/hooks"
import { usePatternVerification } from "@/hooks/use-pattern-verification"
import { PatternVerificationPanel } from "@/components/side-panel/pattern-verification"
import { ActionSettingsPopover } from "@/components/side-panel/action-settings-popover"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"
import { refreshPR } from "@/lib/api"

export function App() {
  const diffContainerRef = useRef<HTMLDivElement>(null)

  const { prNumber } = usePRContext()

  const { pr, isLoading: isPRLoading, error: prError, refetch: refetchPR } = usePR()
  const { files, isLoading: isDiffLoading, error: diffError, refetch: refetchDiff } = useDiff()
  const { comments, isLoading: isCommentsLoading, refetch: refetchComments } = useComments()
  const {
    draftComments,
    addDraftComment,
    updateDraftComment,
    removeDraftComment,
    submitDraftReview: handleSubmitDraftReview,
    draftCount,
    refetch: refetchDraftComments,
  } = useDraftComments()

  const {
    viewedFiles,
    syncingFiles: syncingViewedFiles,
    setViewed: setFileViewed,
    refetch: refetchViewedFiles,
  } = useViewedFiles()

  const [isDraftActionLoading, setIsDraftActionLoading] = useState(false)

  const [convertingAIItemIds, setConvertingAIItemIds] = useState<Set<string>>(new Set())
  const [convertedAIItemIds, setConvertedAIItemIds] = useState<Set<string>>(new Set())

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [selectedFilePath, setSelectedFilePath] = useState<string>()
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshPR()
      await Promise.all([
        refetchPR(),
        refetchDiff(),
        refetchComments(),
        refetchDraftComments(),
        refetchViewedFiles(),
      ])
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchPR, refetchDiff, refetchComments, refetchDraftComments, refetchViewedFiles])

  const handleCommentSubmit = useCallback(
    async (
      filePath: string,
      lineNumber: number,
      side: "additions" | "deletions",
      content: string
    ) => {
      await addDraftComment(filePath, lineNumber, side, content)
    },
    [addDraftComment]
  )

  const handleEditDraft = useCallback(async (commentId: string, content: string) => {
    setIsDraftActionLoading(true)
    try {
      await updateDraftComment(commentId, content)
    } finally {
      setIsDraftActionLoading(false)
    }
  }, [updateDraftComment])

  const handleDeleteDraft = useCallback(async (commentId: string) => {
    setIsDraftActionLoading(true)
    try {
      await removeDraftComment(commentId)
    } finally {
      setIsDraftActionLoading(false)
    }
  }, [removeDraftComment])

  const handleSubmitReview = useCallback(async (
    event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE',
    body?: string
  ) => {
    try {
      await handleSubmitDraftReview(event, body)
      toast.success("Review submitted successfully")
      await refetchComments()
    } catch (error) {
      toast.error("Failed to submit review", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }, [handleSubmitDraftReview, refetchComments])

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

  const visibleAIReviewItems = useMemo(
    () => aiReviewItems.filter((item) => !convertedAIItemIds.has(item.id)),
    [aiReviewItems, convertedAIItemIds]
  )

  const handleConvertAIToDraft = useCallback(async (itemId: string) => {
    const item = aiReviewItems.find((i) => i.id === itemId)
    if (!item) return

    const content = item.suggestion
      ? `${item.message}\n\n**Suggestion:** ${item.suggestion}`
      : item.message

    setConvertingAIItemIds((prev) => new Set(prev).add(itemId))

    try {
      await addDraftComment(item.filePath, item.lineNumber, "additions", content)
      setConvertedAIItemIds((prev) => new Set(prev).add(itemId))
      toast.success("Added to draft review")
    } catch (error) {
      toast.error("Failed to add to draft", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setConvertingAIItemIds((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }, [aiReviewItems, addDraftComment])

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

  const scrollToFile = useCallback((filePath: string) => {
    const container = diffContainerRef.current
    if (!container) return

    const fileElement = container.querySelector(`[data-file-path="${CSS.escape(filePath)}"]`)
    if (fileElement) {
      fileElement.scrollIntoView({ behavior: "instant", block: "start" })
    }
  }, [])

  const scrollToAnnotation = useCallback((filePath: string, lineNumber: number) => {
    const container = diffContainerRef.current
    if (!container) return

    const annotationElement = container.querySelector(
      `[data-file-path="${CSS.escape(filePath)}"] [data-annotation-line="${lineNumber}"]`
    )
    if (annotationElement) {
      annotationElement.scrollIntoView({ behavior: "instant", block: "center" })
    } else {
      scrollToFile(filePath)
    }
  }, [scrollToFile])

  const handleFileTreeSelect = useCallback((filePath: string) => {
    setSelectedFilePath(filePath)
    scrollToFile(filePath)
  }, [scrollToFile])

  const handleFileViewedChange = useCallback((filePath: string, isViewed: boolean) => {
    setFileViewed(filePath, isViewed)
  }, [setFileViewed])

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
                  files={files}
                  annotations={annotations}
                  aiReviewItems={visibleAIReviewItems}
                  onCommentSubmit={handleCommentSubmit}
                  onEditDraft={handleEditDraft}
                  onDeleteDraft={handleDeleteDraft}
                  isDraftActionLoading={isDraftActionLoading}
                  onConvertAIToDraft={handleConvertAIToDraft}
                  convertingAIItemIds={convertingAIItemIds}
                  viewedFiles={viewedFiles}
                  onFileViewedChange={handleFileViewedChange}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={triggerReview}
                    disabled={isReviewLoading}
                    className="flex-1"
                  >
                    {isReviewLoading ? "Generating AI Review..." : "Generate AI Review"}
                  </Button>
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
