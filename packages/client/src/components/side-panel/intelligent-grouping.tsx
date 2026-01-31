import { cn } from "@/lib/utils"
import type { ChangeGroup } from "@/types/grouping"
import { ChangeGroupCard } from "./change-group-card"

interface IntelligentGroupingProps extends React.ComponentProps<"div"> {
  groups: ChangeGroup[]
  onGroupClick?: (groupId: string) => void
}

function IntelligentGrouping({
  className,
  groups,
  onGroupClick,
  ...props
}: IntelligentGroupingProps) {
  return (
    <div
      data-slot="intelligent-grouping"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups available</p>
      ) : (
        groups.map((group) => (
          <ChangeGroupCard
            key={group.id}
            group={group}
            onClick={() => onGroupClick?.(group.id)}
          />
        ))
      )}
    </div>
  )
}

export { IntelligentGrouping }
