import { useRef, useCallback, useState, useMemo } from "react"
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
import { ChatPopup } from "@/components/chat"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { useChat, useAIReview, usePR, useDiff, useComments, useDraftComments, usePRParams, useRelatedFiles } from "@/hooks"
import { usePatternVerification } from "@/hooks/use-pattern-verification"
import { PatternVerificationPanel } from "@/components/side-panel/pattern-verification"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"
import {
  mockPR,
  mockChangeGroups,
  mockAIReviewItems,
  mockComments,
} from "@/lib/mock-data"

export function App() {
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const [chatOpen, setChatOpen] = useState(() =>
    getStorageItem(StorageKeys.CHAT_OPEN, false)
  )

  // Get PR params from URL
  const { prNumber, repo } = usePRParams()
  const isDemo = !prNumber

  // Fetch real PR data
  const { pr, isLoading: isPRLoading, error: prError, refetch: refetchPR } = usePR({ prNumber, repo })
  const { files, isLoading: isDiffLoading, error: diffError, refetch: refetchDiff } = useDiff({ prNumber, repo })
  const { comments, isLoading: isCommentsLoading, refetch: refetchComments } = useComments({ prNumber, repo })
  const { draftComments, addDraftComment, refetch: refetchDraftComments } = useDraftComments({ prNumber })

  // Use real PR data or fall back to mock in demo mode
  const displayPR = isDemo ? mockPR : (pr ?? null)
  const displayFiles = isDemo ? [] : files

  const handleChatOpenChange = useCallback((open: boolean) => {
    setChatOpen(open)
    setStorageItem(StorageKeys.CHAT_OPEN, open)
  }, [])

  const handleRefresh = useCallback(() => {
    refetchPR()
    refetchDiff()
    refetchComments()
    refetchDraftComments()
  }, [refetchPR, refetchDiff, refetchComments, refetchDraftComments])

  // Handle comment submission
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

  const { messages, sendMessage, isStreaming } = useChat()
  const { 
    groups, 
    generateGroups, 
    isGeneratingGroups, 
    error: groupingError,
    items: aiReviewItems,
    triggerReview,
    isLoading: isReviewLoading,
  } = useAIReview({
    prNumber,
    repo,
    autoGenerate: false, // Only generate when button is clicked
  })

  const {
    files: relatedFiles,
    findFiles: findRelatedFiles,
    isLoading: isLoadingRelatedFiles,
    error: relatedFilesError,
  } = useRelatedFiles({
    prNumber,
    repo,
    autoGenerate: false,
  })

  const {
    result: verificationResult,
    isLoading: isVerifying,
    error: verificationError,
    verify: verifyPatterns,
  } = usePatternVerification({
    repo: repo || '',
    prNumber: prNumber || 0,
  })

  const annotations = useMemo(
    () => [...(isDemo ? mockComments : comments), ...draftComments],
    [isDemo, comments, draftComments]
  )

  const displayGroups = useMemo(
    () => groups.length > 0 ? groups : (isDemo ? mockChangeGroups : []),
    [groups, isDemo]
  )

  const displayAIReviewItems = useMemo(
    () => aiReviewItems.length > 0 ? aiReviewItems : (isDemo ? mockAIReviewItems : []),
    [aiReviewItems, isDemo]
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



  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar.Root>
        {isPRLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="animate-pulse">Loading PR info...</span>
          </div>
        ) : prError && !pr ? (
          <div className="flex items-center gap-2 text-destructive">
            <span>Failed to load PR: {prError.message}</span>
          </div>
        ) : displayPR ? (
          <TopBar.PRInfo pr={displayPR} />
        ) : null}
        <TopBar.Actions>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isPRLoading || isDiffLoading || isCommentsLoading}
            >
              {isPRLoading || isDiffLoading || isCommentsLoading ? "Loading..." : "Refresh"}
            </Button>
          <Button variant="outline" size="sm">
            Settings
          </Button>
          <ModeToggle />
        </TopBar.Actions>
      </TopBar.Root>

      <MainLayout
        className="min-h-0 flex-1"
        leftPanel={
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
              ) : diffError && displayFiles.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                  <p className="text-destructive">Failed to load diff</p>
                  <p className="text-sm text-muted-foreground">{diffError.message}</p>
                  {!prNumber && (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Add <code className="rounded bg-muted px-1">?pr=NUMBER</code> to the URL to load a PR
                    </p>
                  )}
                </div>
              ) : displayFiles.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
                  <p>No files to display</p>
                  {!prNumber && (
                    <p className="text-sm">
                      Add <code className="rounded bg-muted px-1">?pr=NUMBER</code> to the URL to load a PR
                    </p>
                  )}
                </div>
              ) : (
                <DiffPanel.Viewer
                  files={displayFiles}
                  annotations={annotations}
                  aiReviewItems={displayAIReviewItems}
                  onCommentSubmit={handleCommentSubmit}
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
                  groups={displayGroups}
                  onFileClick={scrollToFile}
                  onGenerateGroups={prNumber ? generateGroups : undefined}
                  isGenerating={isGeneratingGroups}
                  error={groupingError}
                />
              </SidePanelGroupingContent>
              <SidePanelAIReviewContent>
                {prNumber && (
                  <div className="mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={triggerReview}
                      disabled={isReviewLoading}
                      className="w-full"
                    >
                      {isReviewLoading ? "Generating AI Review..." : "Generate AI Review"}
                    </Button>
                  </div>
                )}
                <AIReviewSummary
                  items={displayAIReviewItems}
                  onItemClick={(item) => {
                    scrollToAnnotation(item.filePath, item.lineNumber)
                  }}
                />
                {prNumber && (
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
                    />
                  </div>
                )}
              </SidePanelAIReviewContent>
              <SidePanelRelatedFilesContent>
                <RelatedFiles
                  files={relatedFiles}
                  onFileClick={scrollToFile}
                  onFindFiles={prNumber ? findRelatedFiles : undefined}
                  isLoading={isLoadingRelatedFiles}
                  error={relatedFilesError}
                />
              </SidePanelRelatedFilesContent>
            </SidePanel>
          </ErrorBoundary>
        }
      />

      <ChatPopup.Root open={chatOpen} onOpenChange={handleChatOpenChange}>
        <ChatPopup.Trigger />
        <ChatPopup.Content title="Lily">
          <ChatPopup.Messages>
            {messages.length === 0 ? (
              <>
                <ChatPopup.Welcome
                  message="Hey! I'm Lily. I've reviewed this PR and I'm ready to help. Ask me anything about the changes, potential issues, or how the code works."
                />
                <div className="flex-1" />
                <ChatPopup.Suggestions
                  prompts={[
                    {
                      label: "Summarize changes",
                      onClick: () => sendMessage("Summarize the changes in this PR"),
                    },
                    {
                      label: "Find potential issues",
                      onClick: () => sendMessage("Find potential issues in this PR"),
                    },
                    {
                      label: "Explain architecture",
                      onClick: () => sendMessage("Explain the architecture of the changes"),
                    },
                  ]}
                />
              </>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatPopup.Message
                    key={message.id}
                    role={message.role}
                    content={message.content}
                  />
                ))}
                {isStreaming && (
                  <div className="text-xs text-muted-foreground animate-pulse">
                    AI is thinking...
                  </div>
                )}
              </>
            )}
          </ChatPopup.Messages>
          <ChatPopup.InputField
            onSend={sendMessage}
            placeholder="Ask Lily anything about this PR"
          />
        </ChatPopup.Content>
      </ChatPopup.Root>
    </div>
  )
}

export default App
