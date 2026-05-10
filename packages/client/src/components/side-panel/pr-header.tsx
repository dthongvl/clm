import { HugeiconsIcon } from "@hugeicons/react"
import { GithubIcon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { PRInfo } from "@/types/pr"

export interface PRHeaderProps extends React.ComponentProps<"header"> {
  pr?: PRInfo
  isLoading?: boolean
  error?: Error | null
}

export function PRHeader({
  pr,
  isLoading,
  error,
  className,
  ...props
}: PRHeaderProps) {
  if (isLoading) {
    return (
      <header className={cn("flex flex-col gap-2", className)} {...props}>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </header>
    )
  }

  if (error || !pr) {
    return null
  }

  return (
    <header className={cn("flex flex-col gap-2", className)} {...props}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">#{pr.number}</p>
          <h2 className="text-base font-semibold leading-tight">{pr.title}</h2>
        </div>
        {pr.url && (
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open this PR on GitHub"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 shrink-0"
            )}
          >
            <HugeiconsIcon icon={GithubIcon} size={14} />
            <span>View on GitHub</span>
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
          </a>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">{pr.baseBranch}</span>
        <span className="mx-1.5">←</span>
        <span className="font-mono">{pr.headBranch}</span>
      </p>
    </header>
  )
}
