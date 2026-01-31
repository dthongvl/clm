"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const STORAGE_KEY = "main-layout-width"
const MIN_WIDTH_PX = 300
const RESIZE_STEP = 2

export type MainLayoutProps = React.ComponentProps<"main"> & {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftWidth?: number
}

function getInitialWidth(defaultWidth: number): number {
  if (typeof window === "undefined") return defaultWidth
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = parseFloat(stored)
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 90) {
      return parsed
    }
  }
  return defaultWidth
}

export function MainLayout({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 70,
  className,
  ...props
}: MainLayoutProps) {
  const [leftWidth, setLeftWidth] = React.useState(() =>
    getInitialWidth(defaultLeftWidth)
  )
  const [isDragging, setIsDragging] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mainRef = React.useRef<HTMLElement>(null)

  const updateWidth = React.useCallback((newWidth: number) => {
    if (!containerRef.current) return

    const containerWidth = containerRef.current.offsetWidth
    const minPercent = (MIN_WIDTH_PX / containerWidth) * 100
    const maxPercent = 100 - minPercent

    const clampedWidth = Math.max(minPercent, Math.min(maxPercent, newWidth))
    setLeftWidth(clampedWidth)
    localStorage.setItem(STORAGE_KEY, String(clampedWidth))
  }, [])

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
    },
    []
  )

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
      updateWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, updateWidth])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          updateWidth(leftWidth - RESIZE_STEP)
          break
        case "ArrowRight":
          e.preventDefault()
          updateWidth(leftWidth + RESIZE_STEP)
          break
        case "Home":
          e.preventDefault()
          updateWidth(defaultLeftWidth)
          break
      }
    },
    [leftWidth, defaultLeftWidth, updateWidth]
  )

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div ref={containerRef} className="flex h-full w-full">
        <main
          ref={mainRef}
          id="main-content"
          role="main"
          data-slot="main-layout"
          className={cn("flex h-full w-full", className)}
          {...props}
        >
          <div
            className="h-full overflow-auto"
            style={{ width: `${leftWidth}%` }}
          >
            {leftPanel}
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(leftWidth)}
            aria-valuemin={10}
            aria-valuemax={90}
            aria-label="Resize panels"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
            className={cn(
              "relative flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-border transition-colors",
              "hover:bg-primary/50 focus:bg-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isDragging && "bg-primary/50"
            )}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
          <div
            className="h-full overflow-auto"
            style={{ width: `${100 - leftWidth}%` }}
          >
            {rightPanel}
          </div>
        </main>
      </div>
    </>
  )
}
