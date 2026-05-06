import { MainLayout } from "@/components/main-layout"
import { DiffPanelProvider, DiffPanelFileTree, DiffPanelViewerContainer } from "@/components/diff-panel"
import { SidePanelContainer } from "@/components/side-panel/side-panel-container"
import { TopBarContainer } from "@/components/top-bar/top-bar-container"
import { useAIReview } from "@/hooks"

/**
 * Root application component.
 *
 * Composes three feature-level containers behind the MainLayout shell.
 * DiffPanelProvider wraps the layout area so file tree, diff viewer,
 * and side panel all share diff data and navigation context.
 *
 * useAIReview is lifted here so its TanStack Query cache is shared
 * between SidePanelContainer (displays all items) and
 * DiffPanelViewerContainer (filters via useAnnotations).
 */
export function App() {
  // Lifted to a shared parent so DiffPanelViewerContainer and
  // SidePanelContainer both read from the same TanStack Query cache.
  const { items: aiReviewItems } = useAIReview()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DiffPanelProvider>
        <MainLayout
          className="h-full"
          header={<TopBarContainer />}
          leftPanel={<DiffPanelFileTree className="h-full" />}
          centerPanel={<DiffPanelViewerContainer aiReviewItems={aiReviewItems} />}
          rightPanel={<SidePanelContainer />}
        />
      </DiffPanelProvider>
    </div>
  )
}

export default App
