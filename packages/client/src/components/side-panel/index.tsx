import * as React from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"

type TabValue = "description" | "grouping" | "ai-review"

interface SidePanelProps extends React.ComponentProps<"aside"> {
  defaultTab?: TabValue
  persistTab?: boolean
}

/**
 * Coerce a persisted side-panel tab value into the supported set. Legacy
 * values (e.g. "review-guide" from the prior stepper surface) fall back to
 * "description" since the Notebook now lives in the center panel.
 */
function normalizeStoredSideTab(value: string, fallback: TabValue): TabValue {
  if (value === "description" || value === "grouping" || value === "ai-review") return value
  return fallback
}

function SidePanel({
  className,
  defaultTab = "description",
  persistTab = true,
  children,
  ...props
}: SidePanelProps) {
  const [tab, setTab] = React.useState<TabValue>(() => {
    if (!persistTab) return defaultTab
    const stored = getStorageItem<string>(StorageKeys.SIDE_PANEL_TAB, defaultTab)
    return normalizeStoredSideTab(stored, defaultTab)
  })

  const handleTabChange = React.useCallback(
    (value: string) => {
      const newTab = value as TabValue
      setTab(newTab)
      if (persistTab) {
        setStorageItem(StorageKeys.SIDE_PANEL_TAB, newTab)
      }
    },
    [persistTab]
  )

  return (
    <aside
      data-slot="side-panel"
      role="complementary"
      aria-label="Side panel"
      className={cn("flex min-h-0 flex-col overflow-hidden", className)}
      {...props}
    >
      <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="line">
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="grouping">Grouping</TabsTrigger>
          <TabsTrigger value="ai-review">AI Review</TabsTrigger>
        </TabsList>
        {children}
      </Tabs>
    </aside>
  )
}

function SidePanelDescriptionContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TabsContent>, "value">) {
  return (
    <TabsContent
      {...props}
      value="description"
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
    >
      <ScrollArea className="h-full">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </TabsContent>
  )
}

function SidePanelGroupingContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TabsContent>, "value">) {
  return (
    <TabsContent
      {...props}
      value="grouping"
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
    >
      <ScrollArea className="h-full">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </TabsContent>
  )
}

function SidePanelAIReviewContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TabsContent>, "value">) {
  return (
    <TabsContent
      {...props}
      value="ai-review"
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
    >
      <ScrollArea className="h-full">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </TabsContent>
  )
}

export {
  SidePanel,
  SidePanelDescriptionContent,
  SidePanelGroupingContent,
  SidePanelAIReviewContent,
}
export { PRDescription } from "./pr-description"
export { PRHeader } from "./pr-header"
export { PRDescriptionBody } from "./pr-description-body"
export { SidePanelContainer } from "./side-panel-container"
export { IntelligentGrouping } from "./intelligent-grouping"
export { AIReviewSummary } from "./ai-review-summary"
export { ChangeGroupCard } from "./change-group-card"
export { ReviewItemCard } from "./review-item-card"

export { ActionTriggerWithContext } from "./action-trigger-with-context"
export type { ActionTriggerWithContextProps } from "./action-trigger-with-context"
export { AIProgressPanel } from "./ai-progress-panel"
export type { AIProgressPanelProps } from "./ai-progress-panel"
