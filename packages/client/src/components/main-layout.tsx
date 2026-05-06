import * as React from "react"

import { cn } from "@/lib/utils"
import { useSidebarState } from "@/hooks/use-sidebar-state"
import {
  ResizablePanelProvider,
  ResizablePanel,
  ResizablePanelContent,
  ResizablePanelHeader,
  ResizablePanelTrigger,
} from "@/components/ui/resizable-panel"

export type MainLayoutProps = React.ComponentProps<"div"> & {
  header: React.ReactNode
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel: React.ReactNode
}

export function MainLayout({
  header,
  leftPanel,
  centerPanel,
  rightPanel,
  className,
  ...props
}: MainLayoutProps) {
  const { leftOpen, rightOpen, setLeftOpen, setRightOpen } = useSidebarState()

  return (
    <ResizablePanelProvider
      side="left"
      defaultOpen={leftOpen}
      open={leftOpen}
      onOpenChange={setLeftOpen}
    >
      <div
        data-slot="main-layout"
        className={cn("flex h-full w-full flex-col", className)}
        {...props}
      >
        {header}
        <div className="flex min-h-0 flex-1">
          {!leftOpen && (
            <div className="flex items-start border-r pt-2 px-1">
              <ResizablePanelTrigger />
            </div>
          )}
          <ResizablePanel
            side="left"
            defaultWidth={280}
            minWidth={180}
            maxWidth={400}
            widthStorageKey="left-sidebar-width"
          >
            <ResizablePanelHeader className="flex-row items-center justify-end">
              <ResizablePanelTrigger />
            </ResizablePanelHeader>
            <ResizablePanelContent>{leftPanel}</ResizablePanelContent>
          </ResizablePanel>

          <ResizablePanelProvider
            side="right"
            defaultOpen={rightOpen}
            open={rightOpen}
            onOpenChange={setRightOpen}
          >
            <main
              id="main-content"
              role="main"
              className="flex-1 min-w-0 overflow-hidden"
            >
              {centerPanel}
            </main>

            <ResizablePanel
              side="right"
              defaultWidth={420}
              minWidth={280}
              maxWidth={600}
              widthStorageKey="right-sidebar-width"
            >
              <ResizablePanelHeader className="flex-row items-center">
                <ResizablePanelTrigger />
              </ResizablePanelHeader>
              <ResizablePanelContent>{rightPanel}</ResizablePanelContent>
            </ResizablePanel>
            {!rightOpen && (
              <div className="flex items-start border-l pt-2 px-1">
                <ResizablePanelTrigger />
              </div>
            )}
          </ResizablePanelProvider>
        </div>
      </div>
    </ResizablePanelProvider>
  )
}
