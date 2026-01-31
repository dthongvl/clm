import { useRef, useCallback, useState } from "react"
import { TopBar } from "@/components/top-bar"
import { MainLayout } from "@/components/main-layout"
import { DiffPanel } from "@/components/diff-panel"
import {
  SidePanel,
  SidePanelGroupingContent,
  SidePanelAIReviewContent,
  IntelligentGrouping,
  AIReviewSummary,
} from "@/components/side-panel"
import { ChatPopup } from "@/components/chat"
import { Button } from "@/components/ui/button"
import { useChat, useAIReview, usePR, useDiff, useComments, useDraftComments } from "@/hooks"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"
import {
  mockPR,
  mockChangeGroups,
  mockAIReviewItems,
  mockComments,
} from "@/lib/mock-data"

// Get PR number from URL search params (e.g., ?pr=123&repo=owner/repo)
function getPRParams() {
  const params = new URLSearchParams(window.location.search)
  const prNumber = params.get("pr")
  const repo = params.get("repo") || undefined
  return {
    prNumber: prNumber ? parseInt(prNumber, 10) : undefined,
    repo,
  }
}

export function App() {
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const [chatOpen, setChatOpen] = useState(() =>
    getStorageItem(StorageKeys.CHAT_OPEN, false)
  )

  // Get PR params from URL
  const { prNumber, repo } = getPRParams()

  // Fetch real PR data
  const { pr, isLoading: isPRLoading, error: prError, refetch: refetchPR } = usePR({ prNumber, repo })
  const { files, isLoading: isDiffLoading, error: diffError, refetch: refetchDiff } = useDiff({ prNumber, repo })
  const { comments, isLoading: isCommentsLoading, refetch: refetchComments } = useComments({ prNumber, repo })
  const { draftComments, addDraftComment, refetch: refetchDraftComments } = useDraftComments({ prNumber })

  // Use real PR data or fall back to mock
  const displayPR = pr ?? mockPR
  const displayFiles = files.length > 0 ? files : []

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
  const { groups, generateGroups, isGeneratingGroups } = useAIReview(displayPR.number)

  const displayGroups = groups.length > 0 ? groups : mockChangeGroups

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

  const handleGroupClick = useCallback((groupId: string) => {
    const allGroups = groups.length > 0 ? groups : mockChangeGroups
    const group = allGroups.find((g) => g.id === groupId)
    if (group && group.files.length > 0) {
      scrollToFile(group.files[0])
    }
  }, [scrollToFile, groups])

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
        ) : (
          <TopBar.PRInfo pr={displayPR} />
        )}
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
        </TopBar.Actions>
      </TopBar.Root>

      <MainLayout
        className="min-h-0 flex-1"
        leftPanel={
          <ErrorBoundary
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
                  annotations={[
                    ...(comments.length > 0 ? comments : mockComments),
                    ...draftComments,
                  ]}
                  onLineClick={(path, line, side) => {
                    console.log(`Clicked line ${line} (${side}) in ${path}`)
                  }}
                  onCommentSubmit={handleCommentSubmit}
                />
              )}
            </DiffPanel.Root>
          </ErrorBoundary>
        }
        rightPanel={
          <ErrorBoundary
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
                  onGroupClick={handleGroupClick}
                  onGenerateGroups={generateGroups}
                  isGenerating={isGeneratingGroups}
                />
              </SidePanelGroupingContent>
              <SidePanelAIReviewContent>
                <AIReviewSummary
                  items={mockAIReviewItems}
                  onItemClick={(item) => {
                    scrollToAnnotation(item.filePath, item.lineNumber)
                  }}
                />
              </SidePanelAIReviewContent>
            </SidePanel>
          </ErrorBoundary>
        }
      />

      <ChatPopup.Root open={chatOpen} onOpenChange={handleChatOpenChange}>
        <ChatPopup.Trigger />
        <ChatPopup.Content title="Ask about this PR">
          <ChatPopup.Messages>
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                Ask any question about this pull request...
              </p>
            ) : (
              messages.map((message) => (
                <ChatPopup.Message
                  key={message.id}
                  role={message.role}
                  content={message.content}
                />
              ))
            )}
            {isStreaming && (
              <div className="text-xs text-muted-foreground animate-pulse">
                AI is thinking...
              </div>
            )}
          </ChatPopup.Messages>
          <ChatPopup.Input
            onSend={sendMessage}
            isLoading={isStreaming}
            placeholder="Ask a question..."
          />
        </ChatPopup.Content>
      </ChatPopup.Root>
    </div>
  )
}

export default App
