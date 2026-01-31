import { useRef, useCallback } from "react"
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
import { Button } from "@/components/ui/button"
import {
  mockPR,
  mockChangeGroups,
  mockAIReviewItems,
  mockDiffFiles,
  mockComments,
} from "@/lib/mock-data"

export function App() {
  const diffContainerRef = useRef<HTMLDivElement>(null)

  const scrollToFile = useCallback((filePath: string) => {
    const container = diffContainerRef.current
    if (!container) return

    const fileElement = container.querySelector(`[data-file-path="${CSS.escape(filePath)}"]`)
    if (fileElement) {
      fileElement.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const scrollToAnnotation = useCallback((filePath: string, lineNumber: number) => {
    const container = diffContainerRef.current
    if (!container) return

    const annotationElement = container.querySelector(
      `[data-file-path="${CSS.escape(filePath)}"] [data-annotation-line="${lineNumber}"]`
    )
    if (annotationElement) {
      annotationElement.scrollIntoView({ behavior: "smooth", block: "center" })
    } else {
      scrollToFile(filePath)
    }
  }, [scrollToFile])

  const handleGroupClick = useCallback((groupId: string) => {
    const group = mockChangeGroups.find((g) => g.id === groupId)
    if (group && group.files.length > 0) {
      scrollToFile(group.files[0])
    }
  }, [scrollToFile])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar.Root>
        <TopBar.PRInfo pr={mockPR} />
        <TopBar.Actions>
          <Button variant="outline" size="sm">
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            Settings
          </Button>
        </TopBar.Actions>
      </TopBar.Root>

      <MainLayout
        className="min-h-0 flex-1"
        leftPanel={
          <DiffPanel.Root ref={diffContainerRef}>
            <DiffPanel.Viewer
              files={mockDiffFiles}
              annotations={mockComments}
              onLineClick={(path, line, side) => {
                console.log(`Clicked line ${line} (${side}) in ${path}`)
              }}
            />
          </DiffPanel.Root>
        }
        rightPanel={
          <SidePanel className="h-full">
            <SidePanelGroupingContent>
              <IntelligentGrouping
                groups={mockChangeGroups}
                onGroupClick={handleGroupClick}
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
        }
      />
    </div>
  )
}

export default App
