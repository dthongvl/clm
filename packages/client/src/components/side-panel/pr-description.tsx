import { cn } from "@/lib/utils"
import { PRHeader } from "./pr-header"
import { PRDescriptionBody } from "./pr-description-body"
import type { PRInfo } from "@/types/pr"

export interface PRDescriptionProps extends React.ComponentProps<"div"> {
  pr?: PRInfo
  isLoading?: boolean
  error?: Error | null
}

/**
 * PRDescription — renders the PR title, branch info, description (markdown)
 * and a button to open the PR on GitHub. Lives inside the side panel
 * "Description" tab.
 */
export function PRDescription({
  pr,
  isLoading,
  error,
  className,
  ...props
}: PRDescriptionProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <PRHeader pr={pr} isLoading={isLoading} error={error} />
      <PRDescriptionBody pr={pr} isLoading={isLoading} error={error} />
    </div>
  )
}
