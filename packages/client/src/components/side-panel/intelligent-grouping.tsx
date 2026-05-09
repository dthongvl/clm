import { cn } from "@/lib/utils"
import type { ChangeGroup } from "@/types/grouping"
import { Button } from "@/components/ui/button"
import { ChangeGroupCard } from "./change-group-card"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"

export interface IntelligentGroupingProps extends React.ComponentProps<"div"> {
  groups: ChangeGroup[]
  onFileClick?: (filePath: string) => void
  isGenerating?: boolean
  error?: Error | null
  onRetry?: () => void
}

/**
 * Results surface for the Grouping tab. Action trigger, description, and
 * live progress are owned by `SidePanelContainer` so the layout matches
 * the AI Review tab; this component only renders the resulting groups,
 * empty/loading/error states.
 */
function IntelligentGrouping({
  className,
  groups,
  onFileClick,
  isGenerating = false,
  error,
  onRetry,
  ...props
}: IntelligentGroupingProps) {
  return (
    <div
      data-slot="intelligent-grouping"
      aria-busy={isGenerating}
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {error ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
            <span className="text-sm font-medium">Failed to generate groups</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {error.message}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isGenerating}
              className="mt-1"
            >
              Try Again
            </Button>
          )}
        </div>
      ) : isGenerating && groups.length === 0 ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-none border border-border bg-muted/50"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No groups available. Click "Generate AI Groupings" to let AI organize your changes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <ChangeGroupCard
              key={group.id}
              group={group}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export { IntelligentGrouping }
