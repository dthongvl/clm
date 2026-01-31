import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PRInfo } from "@/types/pr"

export type TopBarPRInfoProps = React.ComponentProps<"div"> & { pr: PRInfo }

const stateStyles = {
  open: "bg-green-500/10 text-green-600 dark:text-green-400",
  merged: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  closed: "bg-red-500/10 text-red-600 dark:text-red-400",
} as const

export function PRInfo({ className, pr, ...props }: TopBarPRInfoProps) {
  return (
    <div
      data-slot="top-bar-pr-info"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">#{pr.number}</span>
        <span className="font-medium">{pr.title}</span>
      </div>
      <Badge className={stateStyles[pr.state]}>{pr.state}</Badge>
      <div className="flex items-center gap-2">
        <img
          src={pr.author.avatarUrl}
          alt={pr.author.login}
          className="size-5 rounded-full"
        />
        <span className="text-sm text-muted-foreground">{pr.author.login}</span>
      </div>
    </div>
  )
}
