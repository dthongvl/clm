import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/ui/severity-badge"
import type { AIReviewItem, AIReviewCategory } from "@/types/review"

const CATEGORY_SHORT_LABELS: Record<AIReviewCategory, string> = {
  "code-quality": "Quality",
  "coding-convention": "Convention",
  "security": "Security",
  "accessibility": "A11y",
  "architecture": "Arch",
  "api-design": "API",
  "performance": "Perf",
  "testing": "Testing",
}

interface ReviewItemCardProps extends React.ComponentProps<"button"> {
  item: AIReviewItem
}

function ReviewItemCard({ className, item, ...props }: ReviewItemCardProps) {
  const categories = item.categories || []
  const visibleCategories = categories.slice(0, 2)
  const remainingCount = categories.length - 2

  return (
    <button
      data-slot="review-item-card"
      type="button"
      className={cn("w-full text-left", className)}
      aria-label={`${item.severity} issue: ${item.message} at ${item.filePath} line ${item.lineNumber}`}
      {...props}
    >
      <Card size="sm" className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex-row items-center gap-1.5 flex-wrap">
          <SeverityBadge severity={item.severity}>
            {item.severity}
          </SeverityBadge>
          {visibleCategories.map((category) => (
            <Badge key={category} variant="outline" className="h-5 px-1.5 text-[10px]">
              {CATEGORY_SHORT_LABELS[category]}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              +{remainingCount}
            </Badge>
          )}
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
