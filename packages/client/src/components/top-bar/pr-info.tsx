import { HugeiconsIcon } from "@hugeicons/react"
import { GithubIcon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"

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
  const numberContent = (
    <span className="text-muted-foreground">#{pr.number}</span>
  )

  return (
    <div
      data-slot="top-bar-pr-info"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {pr.url ? (
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            title="Open PR on GitHub"
          >
            {numberContent}
          </a>
        ) : (
          numberContent
        )}
        <span className="font-medium">{pr.title}</span>
      </div>
      <Badge className={stateStyles[pr.state]}>{pr.state}</Badge>
      <div className="flex items-center gap-2">
        <img
          src={pr.author.avatarUrl}
          alt={pr.author.login}
          referrerPolicy="no-referrer"
          className="size-5 rounded-full"
        />
        <span className="text-sm text-muted-foreground">{pr.author.login}</span>
      </div>
      {pr.url && (
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          title="Open this PR on GitHub"
          aria-label="Open this PR on GitHub"
        >
          <HugeiconsIcon icon={GithubIcon} size={14} />
          <span>Open</span>
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
        </a>
      )}
    </div>
  )
}
