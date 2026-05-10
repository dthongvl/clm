import { cn } from "@/lib/utils"
import { SeverityBadge } from "@/components/ui/severity-badge"
import type { AIReviewItem, Severity } from "@/types/review"
import { ReviewItemCard } from "./review-item-card"

interface AIReviewSummaryProps extends React.ComponentProps<"div"> {
  items: AIReviewItem[]
  onItemClick?: (item: AIReviewItem) => void
}

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"]

function AIReviewSummary({
  className,
  items,
  onItemClick,
  ...props
}: AIReviewSummaryProps) {
  const groupedItems = items.reduce(
    (acc, item) => {
      acc[item.severity].push(item)
      return acc
    },
    { critical: [], warning: [], info: [] } as Record<Severity, AIReviewItem[]>
  )

  const counts = {
    critical: groupedItems.critical.length,
    warning: groupedItems.warning.length,
    info: groupedItems.info.length,
  }

  return (
    <div
      data-slot="ai-review-summary"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <div className="flex gap-2" aria-label="Issue counts by severity">
        {SEVERITY_ORDER.map((severity) => (
          <SeverityBadge key={severity} severity={severity} style="outline">
            {counts[severity]} {severity}
          </SeverityBadge>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues found</p>
      ) : (
        <div className="flex flex-col gap-4">
          {SEVERITY_ORDER.map(
            (severity) =>
              groupedItems[severity].length > 0 && (
                <section key={severity} aria-labelledby={`${severity}-heading`}>
                  <h3
                    id={`${severity}-heading`}
                    className="mb-2 text-xs font-medium uppercase text-muted-foreground"
                  >
                    {severity} ({groupedItems[severity].length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {groupedItems[severity].map((item) => (
                      <ReviewItemCard
                        key={item.id}
                        item={item}
                        onClick={() => onItemClick?.(item)}
                      />
                    ))}
                  </div>
                </section>
              )
          )}
        </div>
      )}
    </div>
  )
}

export { AIReviewSummary }
