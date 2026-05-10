import { Markdown } from "@/components/ui/markdown"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { PRInfo } from "@/types/pr"

export interface PRDescriptionBodyProps extends React.ComponentProps<"section"> {
  pr?: PRInfo
  isLoading?: boolean
  error?: Error | null
}

export function PRDescriptionBody({
  pr,
  isLoading,
  error,
  className,
  ...props
}: PRDescriptionBodyProps) {
  if (isLoading) {
    return (
      <section className={cn("space-y-3", className)} {...props}>
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  if (error || !pr) {
    return (
      <section
        className={cn(
          "rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive",
          className
        )}
        {...props}
      >
        {error?.message ?? "PR information unavailable."}
      </section>
    )
  }

  const hasDescription = pr.description.trim().length > 0

  return (
    <section aria-label="PR description" className={cn(className)} {...props}>
      {hasDescription ? (
        <Markdown>{pr.description}</Markdown>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm italic text-muted-foreground">
          No description provided for this PR.
        </p>
      )}
    </section>
  )
}
