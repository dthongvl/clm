import { MainLayout } from "@/components/main-layout"
import { DiffPanelProvider } from "@/components/diff-panel"
import { TopBarContainer } from "@/components/top-bar/top-bar-container"
import { CenterPanelContainer } from "@/components/center-panel"
import { RightPanelContainer } from "@/components/right-panel"

/**
 * Root application component.
 *
 * Composes feature-level containers behind the MainLayout shell.
 * DiffPanelProvider wraps the layout area so file tree, diff viewer,
 * and side panels all share diff data and navigation context.
 *
 * Layout:
 * - Top bar: PR info and actions
 * - Center: Description / Review Guide / File changes tabs
 * - Right sidebar: Grouping / AI Review tabs
 */
export function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DiffPanelProvider>
        <MainLayout
          className="h-full"
          header={<TopBarContainer />}
          centerPanel={<CenterPanelContainer />}
          rightPanel={<RightPanelContainer />}
        />
      </DiffPanelProvider>
    </div>
  )
}

export default App
