"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import type { Layout } from "react-resizable-panels"

const STORAGE_KEY = "code-review:main-layout-sizes"
const LEFT_PANEL_ID = "left"
const RIGHT_PANEL_ID = "right"

export type MainLayoutProps = React.ComponentProps<"main"> & {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftSize?: number
}

function getPersistedLayout(): Layout | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Layout
      if (
        typeof parsed === "object" &&
        LEFT_PANEL_ID in parsed &&
        RIGHT_PANEL_ID in parsed
      ) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors
  }
  return undefined
}

function persistLayout(layout: Layout): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Ignore storage errors
  }
}

export function MainLayout({
  leftPanel,
  rightPanel,
  defaultLeftSize = 70,
  className,
  ...props
}: MainLayoutProps) {
  const persistedLayout = React.useMemo(() => getPersistedLayout(), [])
  const defaultLayout: Layout = persistedLayout ?? {
    [LEFT_PANEL_ID]: defaultLeftSize,
    [RIGHT_PANEL_ID]: 100 - defaultLeftSize,
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        role="main"
        data-slot="main-layout"
        className={cn("flex min-h-0 h-full w-full", className)}
        {...props}
      >
        <ResizablePanelGroup
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={persistLayout}
          className="h-full w-full"
        >
          <ResizablePanel id={LEFT_PANEL_ID} minSize="20%" maxSize="80%">
            <div className="h-full overflow-hidden">{leftPanel}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id={RIGHT_PANEL_ID} minSize="20%" maxSize="80%">
            <div className="h-full overflow-hidden">{rightPanel}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </>
  )
}
