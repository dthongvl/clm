import { cn } from "@/lib/utils"
import type { ChangeGroup } from "@/types/grouping"
import { Button } from "@/components/ui/button"
import { ChangeGroupCard } from "./change-group-card"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiGenerativeIcon, Loading03Icon } from "@hugeicons/core-free-icons"

export interface IntelligentGroupingProps extends React.ComponentProps<"div"> {
  groups: ChangeGroup[]
  onGroupClick?: (groupId: string) => void
  onGenerateGroups?: () => void
  isGenerating?: boolean
}

function IntelligentGrouping({
  className,
  groups,
  onGroupClick,
  onGenerateGroups,
  isGenerating = false,
  ...props
}: IntelligentGroupingProps) {
  return (
    <div
      data-slot="intelligent-grouping"
      aria-busy={isGenerating}
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {onGenerateGroups && (
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateGroups}
          disabled={isGenerating}
          className="w-full"
          aria-label={isGenerating ? "Generating groups..." : "Generate AI groupings"}
        >
          <HugeiconsIcon
            icon={isGenerating ? Loading03Icon : AiGenerativeIcon}
            className={cn(isGenerating && "animate-spin")}
            data-icon="inline-start"
          />
          {isGenerating ? "Generating..." : "Generate AI Groupings"}
        </Button>
      )}

      {isGenerating ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-none border border-border bg-muted/50"
              aria-hidden="true"
            />
          ))}
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            AI is analyzing your changes...
          </p>
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
              onClick={() => onGroupClick?.(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export { IntelligentGrouping }
