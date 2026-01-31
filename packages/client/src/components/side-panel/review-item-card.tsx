import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { SeverityBadge } from "@/components/ui/severity-badge"
import type { AIReviewItem } from "@/types/review"

interface ReviewItemCardProps extends React.ComponentProps<"button"> {
  item: AIReviewItem
}

function ReviewItemCard({ className, item, ...props }: ReviewItemCardProps) {
  return (
    <button
      data-slot="review-item-card"
      type="button"
      className={cn("w-full text-left", className)}
      aria-label={`${item.severity} issue: ${item.message} at ${item.filePath} line ${item.lineNumber}`}
      {...props}
    >
      <Card size="sm" className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex-row items-center gap-2">
          <SeverityBadge severity={item.severity}>
            {item.severity}
          </SeverityBadge>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm">{item.message}</p>
          <p className="text-xs text-muted-foreground">
            {item.filePath}:{item.lineNumber}
          </p>
        </CardContent>
      </Card>
    </button>
  )
}

export { ReviewItemCard }
