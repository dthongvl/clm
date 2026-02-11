import * as React from "react"

import { cn } from "@/lib/utils"
import { usePersistedState } from "@/hooks"
import { StorageKeys } from "@/lib/storage"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  SidebarRightProvider,
  SidebarRight,
  SidebarRightContent,
  SidebarRightTrigger,
} from "@/components/ui/sidebar-right"

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
  const [leftOpen, setLeftOpen] = usePersistedState(
    StorageKeys.LEFT_SIDEBAR_OPEN,
    true
  )
  const [rightOpen, setRightOpen] = usePersistedState(
    StorageKeys.RIGHT_SIDEBAR_OPEN,
    true
  )

  return (
    <SidebarProvider
      defaultOpen={leftOpen}
      open={leftOpen}
      onOpenChange={setLeftOpen}
    >
      <SidebarRightProvider
        defaultOpen={rightOpen}
        open={rightOpen}
        onOpenChange={setRightOpen}
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
                <SidebarTrigger />
              </div>
            )}
            <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
              <SidebarHeader className="flex-row items-center justify-end">
                <SidebarTrigger />
              </SidebarHeader>
              <SidebarContent>{leftPanel}</SidebarContent>
            </Sidebar>

            <main
              id="main-content"
              role="main"
              className="flex-1 min-w-0 overflow-hidden"
            >
              {centerPanel}
            </main>

            <SidebarRight>
              <SidebarHeader className="flex-row items-center">
                <SidebarRightTrigger />
              </SidebarHeader>
              <SidebarRightContent>{rightPanel}</SidebarRightContent>
            </SidebarRight>
            {!rightOpen && (
              <div className="flex items-start border-l pt-2 px-1">
                <SidebarRightTrigger />
              </div>
            )}
          </div>
        </div>
      </SidebarRightProvider>
    </SidebarProvider>
  )
}
