import { useState } from "react"
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
  mockFileTree,
  mockChangeGroups,
  mockAIReviewItems,
  mockDiffFiles,
  mockComments,
} from "@/lib/mock-data"

export function App() {
  const [selectedFile, setSelectedFile] = useState<string | undefined>()

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
        leftPanel={
          <DiffPanel.Root>
            <DiffPanel.FileTree
              files={mockFileTree}
              selectedPath={selectedFile}
              onSelectFile={setSelectedFile}
            />
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
                onGroupClick={(groupId) => console.log("Group clicked:", groupId)}
              />
            </SidePanelGroupingContent>
            <SidePanelAIReviewContent>
              <AIReviewSummary
                items={mockAIReviewItems}
                onItemClick={(item) => {
                  console.log("Review item clicked:", item)
                  setSelectedFile(item.filePath)
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
