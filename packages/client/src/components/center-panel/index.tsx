import { useState, useCallback } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  InformationCircleIcon,
  GitCompareIcon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import {
  ResizablePanelProvider,
  ResizablePanel,
  ResizablePanelContent,
} from "@/components/ui/resizable-panel"
import { usePR, useAIReview, usePRContext } from "@/hooks"
import { PRDescriptionBody } from "@/components/side-panel/pr-description-body"
import { Notebook } from "@/components/notebook"
import {
  DiffPanelViewerContainer,
  DiffPanelFileTree,
} from "@/components/diff-panel"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"
import { cn } from "@/lib/utils"

type CenterTabValue = "pr-info" | "notebook" | "diff-view"

type NavItem = {
  value: CenterTabValue
  label: string
  icon: IconSvgElement
}

const NAV_ITEMS: NavItem[] = [
  { value: "pr-info", label: "Description", icon: InformationCircleIcon },
  { value: "notebook", label: "Notebook", icon: BookOpen01Icon },
  { value: "diff-view", label: "File changes", icon: GitCompareIcon },
]

/**
 * Compatibility shim: map any persisted legacy tab value to the new vocabulary
 * before rendering, so users with old localStorage entries still land on a
 * valid tab.
 */
function normalizeStoredTab(value: string | null): CenterTabValue {
  if (value === "review-guide") return "notebook"
  if (value === "pr-info" || value === "notebook" || value === "diff-view") return value
  return "diff-view"
}

export function CenterPanelContainer() {
  const { prNumber } = usePRContext()
  const { data: pr, isLoading: isPRLoading, error: prError } = usePR()
  const { items: aiReviewItems } = useAIReview()

  const [tab, setTab] = useState<CenterTabValue>(() =>
    normalizeStoredTab(
      getStorageItem<string>(StorageKeys.CENTER_PANEL_TAB, "diff-view"),
    ),
  )

  const handleTabChange = useCallback((value: CenterTabValue) => {
    setTab(value)
    setStorageItem(StorageKeys.CENTER_PANEL_TAB, value)
  }, [])

  return (
    <ErrorBoundary
      resetKeys={[prNumber]}
      fallback={
        <ErrorFallback
          title="Failed to load content"
          description="There was an error loading the PR content."
          className="m-4"
        />
      }
    >
      <div className="flex h-full overflow-hidden">
        <nav className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-3">
          {NAV_ITEMS.map((item) => {
            const isActive = tab === item.value
            return (
              <Tooltip key={item.value}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => handleTabChange(item.value)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        isActive && "bg-accent text-foreground"
                      )}
                    >
                      <HugeiconsIcon icon={item.icon} size={18} />
                    </button>
                  }
                />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {tab === "pr-info" && (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="p-4">
                <PRDescriptionBody
                  pr={pr}
                  isLoading={isPRLoading}
                  error={prError as Error | null}
                />
              </div>
            </div>
          )}
          {tab === "notebook" && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <Notebook.Root />
            </div>
          )}
          {tab === "diff-view" && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ResizablePanelProvider side="left" defaultOpen>
                <div className="flex h-full min-h-0">
                  <ResizablePanel
                    side="left"
                    defaultWidth={288}
                    minWidth={200}
                    maxWidth={480}
                    widthStorageKey={StorageKeys.FILE_TREE_WIDTH}
                  >
                    <ResizablePanelContent>
                      <DiffPanelFileTree className="h-full" />
                    </ResizablePanelContent>
                  </ResizablePanel>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <DiffPanelViewerContainer aiReviewItems={aiReviewItems} />
                  </div>
                </div>
              </ResizablePanelProvider>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
