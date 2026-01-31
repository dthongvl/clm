import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SidePanelProps extends React.ComponentProps<"aside"> {
  defaultTab?: "grouping" | "ai-review"
}

function SidePanel({ className, defaultTab = "grouping", children, ...props }: SidePanelProps) {
  return (
    <aside
      data-slot="side-panel"
      role="complementary"
      aria-label="Side panel"
      className={cn("flex flex-col", className)}
      {...props}
    >
      <Tabs defaultValue={defaultTab} className="flex flex-1 flex-col">
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
