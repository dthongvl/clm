import * as React from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"

type TabValue = "grouping" | "ai-review"

interface SidePanelProps extends React.ComponentProps<"aside"> {
  defaultTab?: TabValue
  persistTab?: boolean
}

function SidePanel({
  className,
  defaultTab = "grouping",
  persistTab = true,
  children,
  ...props
}: SidePanelProps) {
  const [tab, setTab] = React.useState<TabValue>(() => {
    if (!persistTab) return defaultTab
    return getStorageItem<TabValue>(StorageKeys.SIDE_PANEL_TAB, defaultTab)
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
      <Tabs value={tab} onValueChange={handleTabChange} className="flex flex-1 flex-col">
        <TabsList variant="line">
          <TabsTrigger value="grouping">Grouping</TabsTrigger>
          <TabsTrigger value="ai-review">AI Review</TabsTrigger>
        </TabsList>
        {children}
      </Tabs>
    </aside>
  )
}

function SidePanelGroupingContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsContent>, "value">) {
  return (
    <TabsContent
      {...props}
      value="grouping"
      className={cn("flex-1 overflow-auto p-4", className)}
    />
  )
}

function SidePanelAIReviewContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsContent>, "value">) {
  return (
    <TabsContent
      {...props}
      value="ai-review"
      className={cn("flex-1 overflow-auto p-4", className)}
    />
  )
}

export { SidePanel, SidePanelGroupingContent, SidePanelAIReviewContent }
export { IntelligentGrouping } from "./intelligent-grouping"
export { AIReviewSummary } from "./ai-review-summary"
export { ChangeGroupCard } from "./change-group-card"
export { ReviewItemCard } from "./review-item-card"
