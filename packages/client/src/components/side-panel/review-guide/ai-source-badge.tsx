import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"

interface AiSourceBadgeProps extends React.ComponentProps<typeof Badge> {
  label?: string
}

/**
 * Provenance badge for AI-emitted "needs your judgment" threads. Persists
 * after a thread is resolved (unlike severity styling which expresses
 * urgency rather than origin).
 */
function AiSourceBadge({
  className,
  label = "AI · needs your judgment",
  ...props
}: AiSourceBadgeProps) {
  return (
    <Badge
      data-slot="ai-source-badge"
      variant="outline"
      className={cn(
        "h-5 gap-1 px-1.5 text-[10px] text-primary border-primary/30 bg-primary/5",
        className
      )}
      aria-label="AI-generated judgment thread"
      {...props}
    >
      <HugeiconsIcon icon={SparklesIcon} className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

export { AiSourceBadge }
