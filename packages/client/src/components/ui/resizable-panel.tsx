import * as React from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { SidebarLeftIcon, SidebarRight01Icon } from "@hugeicons/core-free-icons"

interface ResizablePanelContextValue {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  isMobile: boolean
  side: "left" | "right"
}

const ResizablePanelContext = React.createContext<ResizablePanelContextValue | null>(null)

function useResizablePanel() {
  const context = React.useContext(ResizablePanelContext)
  if (!context) {
    throw new Error("useResizablePanel must be used within a ResizablePanelProvider.")
  }
  return context
}

/* ------------------------------------------------------------------ */
//  Provider
/* ------------------------------------------------------------------ */

interface ResizablePanelProviderProps extends React.ComponentProps<"div"> {
  side?: "left" | "right"
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function ResizablePanelProvider({
  side = "left",
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  children,
  ...props
}: ResizablePanelProviderProps) {
  const isMobile = useIsMobile()
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open

  const setOpen = React.useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(open) : value
      if (setOpenProp) setOpenProp(next)
      else _setOpen(next)
    },
    [setOpenProp, open]
  )

  const toggle = React.useCallback(() => setOpen((v) => !v), [setOpen])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<ResizablePanelContextValue>(
    () => ({ state, open, setOpen, toggle, isMobile, side }),
    [state, open, setOpen, toggle, isMobile, side]
  )

  return (
    <ResizablePanelContext.Provider value={contextValue}>
      <div className={cn("contents", className)} {...props}>
        {children}
      </div>
    </ResizablePanelContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
//  Panel
/* ------------------------------------------------------------------ */

interface ResizablePanelProps extends React.ComponentProps<"div"> {
  side?: "left" | "right"
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  widthStorageKey: string
  collapsible?: boolean
}

function ResizablePanel({
  side = "left",
  defaultWidth = 280,
  minWidth = 180,
  maxWidth = 480,
  widthStorageKey,
  collapsible = true,
  className,
  children,
  ...props
}: ResizablePanelProps) {
  const { isMobile, open, setOpen } = useResizablePanel()
  const [width, setWidth] = usePersistedState(widthStorageKey, defaultWidth)
  const [isResizing, setIsResizing] = React.useState(false)
  const [hoverHandle, setHoverHandle] = React.useState(false)
  const startXRef = React.useRef(0)
  const startWidthRef = React.useRef(0)
  const panelRef = React.useRef<HTMLDivElement>(null)

  const clamp = React.useCallback(
    (w: number) => Math.min(Math.max(w, minWidth), maxWidth),
    [minWidth, maxWidth]
  )

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = width
    },
    [width]
  )

  React.useEffect(() => {
    if (!isResizing) return
    const handleMove = (e: MouseEvent) => {
      const delta = side === "left" ? e.clientX - startXRef.current : startXRef.current - e.clientX
      const newWidth = clamp(startWidthRef.current + delta)
      setWidth(newWidth)
    }
    const handleUp = () => {
      setIsResizing(false)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"
    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
    }
  }, [isResizing, side, clamp, setWidth])

  if (collapsible === false) {
    return (
      <div
        ref={panelRef}
        style={{ width: clamp(width) }}
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full flex-col border-r",
          side === "right" && "border-l border-r-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen} {...props}>
        <SheetContent
          data-slot="resizable-panel"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-[18rem] p-0 [&>button]:hidden"
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  const handleEl = open ? (
    <div
      data-slot="resizable-panel-handle"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHoverHandle(true)}
      onMouseLeave={() => setHoverHandle(false)}
      className={cn(
        "relative z-20 shrink-0 cursor-col-resize flex justify-center",
        side === "left" ? "-ml-px" : "-mr-px"
      )}
      style={{ width: 8 }}
    >
      <div
        className={cn(
          "absolute top-0 bottom-0 w-px bg-transparent transition-colors",
          (hoverHandle || isResizing) && "bg-border"
        )}
      />
      {/* Wider invisible hit area */}
      <div
        className="absolute inset-y-0 cursor-col-resize"
        style={{ left: -4, right: -4 }}
      />
    </div>
  ) : null

  return (
    <>
      {side === "right" && handleEl}
      <div
        ref={panelRef}
        data-state={open ? "expanded" : "collapsed"}
        data-side={side}
        data-slot="resizable-panel"
        style={{
          width: open ? clamp(width) : 0,
          opacity: open ? 1 : 0,
          overflow: open ? undefined : "hidden",
        }}
        className={cn(
          "bg-sidebar text-sidebar-foreground relative flex h-full flex-col shrink-0",
          side === "left" ? "border-r" : "border-l",
          isResizing ? "transition-none" : "transition-[width,opacity] duration-200 ease-linear",
          className
        )}
        {...props}
      >
        {children}
      </div>
      {side === "left" && handleEl}
    </>
  )
}

/* ------------------------------------------------------------------ */
//  Trigger
/* ------------------------------------------------------------------ */

function ResizablePanelTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggle, side } = useResizablePanel()

  return (
    <Button
      data-slot="resizable-panel-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        toggle()
      }}
      {...props}
    >
      <HugeiconsIcon
        icon={side === "left" ? SidebarLeftIcon : SidebarRight01Icon}
        strokeWidth={2}
      />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

/* ------------------------------------------------------------------ */
//  Layout primitives
/* ------------------------------------------------------------------ */

function ResizablePanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="resizable-panel-header"
      className={cn("gap-2 p-2 flex flex-col", className)}
      {...props}
    />
  )
}

function ResizablePanelContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="resizable-panel-content"
      className={cn(
        "no-scrollbar gap-0 flex min-h-0 flex-1 flex-col overflow-auto",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanelInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="resizable-panel-inset"
      className={cn("relative flex w-full flex-1 flex-col", className)}
      {...props}
    />
  )
}

export {
  ResizablePanelProvider,
  ResizablePanel,
  ResizablePanelTrigger,
  ResizablePanelHeader,
  ResizablePanelContent,
  ResizablePanelInset,
}
