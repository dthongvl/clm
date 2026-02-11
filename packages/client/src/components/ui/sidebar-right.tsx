import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { SidebarRight01Icon } from "@hugeicons/core-free-icons"

const SIDEBAR_RIGHT_COOKIE_NAME = "sidebar_right_state"
const SIDEBAR_RIGHT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_RIGHT_WIDTH = "420px"
const SIDEBAR_RIGHT_WIDTH_MOBILE = "18rem"
const SIDEBAR_RIGHT_KEYBOARD_SHORTCUT = "]"

type SidebarRightContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarRightContext =
  React.createContext<SidebarRightContextProps | null>(null)

function useSidebarRight() {
  const context = React.useContext(SidebarRightContext)
  if (!context) {
    throw new Error(
      "useSidebarRight must be used within a SidebarRightProvider."
    )
  }

  return context
}

function SidebarRightProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      document.cookie = `${SIDEBAR_RIGHT_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_RIGHT_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile
      ? setOpenMobile((open) => !open)
      : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_RIGHT_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarRightContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarRightContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-right-wrapper"
        style={
          {
            "--sidebar-right-width": SIDEBAR_RIGHT_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-right-wrapper flex h-full w-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarRightContext.Provider>
  )
}

function SidebarRight({
  className,
  children,
  dir,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebarRight()

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar-right"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-right-width) p-0 [&>button]:hidden"
          style={
            {
              "--sidebar-right-width": SIDEBAR_RIGHT_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Right Sidebar</SheetTitle>
            <SheetDescription>
              Displays the mobile right sidebar.
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden h-full md:flex"
      data-state={state}
      data-collapsible={state === "collapsed" ? "offcanvas" : ""}
      data-side="right"
      data-slot="sidebar-right"
    >
      <div
        data-slot="sidebar-right-container"
        className={cn(
          "bg-sidebar flex h-full w-(--sidebar-right-width) flex-col overflow-hidden border-l transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:border-l-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

function SidebarRightTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebarRight()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-right-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <HugeiconsIcon icon={SidebarRight01Icon} strokeWidth={2} />
      <span className="sr-only">Toggle Right Sidebar</span>
    </Button>
  )
}

function SidebarRightContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-right-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar gap-0 flex min-h-0 flex-1 flex-col overflow-auto",
        className
      )}
      {...props}
    />
  )
}

export {
  SidebarRight,
  SidebarRightContent,
  SidebarRightProvider,
  SidebarRightTrigger,
  useSidebarRight,
}
