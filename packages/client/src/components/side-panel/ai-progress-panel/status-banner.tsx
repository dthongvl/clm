import { Check, X as XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { StreamStatusPhase } from "@/api/ai"
import type { StreamingStatus } from "@/hooks/use-ai-review"

const PHASE_LABEL: Record<StreamStatusPhase, string> = {
  starting: "Starting…",
  fetching_pr: "Fetching PR…",
  analyzing: "Analyzing…",
  finalizing: "Finalizing…",
}

interface StatusBannerProps {
  status: StreamingStatus
  phase: StreamStatusPhase | null
  error: string | null
  onCancel: () => void
}

export function StatusBanner({
  status,
  phase,
  error,
  onCancel,
}: StatusBannerProps) {
  const label = bannerLabel(status, phase, error)

  return (
    <div className="flex items-center gap-2 rounded-md border border-foreground/10 bg-card px-3 py-2 text-xs">
      <BannerIcon status={status} />
      <span
        className={cn(
          "flex-1 truncate",
          status === "error" && "text-destructive",
          status === "cancelled" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {status === "streaming" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          aria-label="Cancel AI review"
          className="h-6 px-2 text-xs"
        >
          Cancel
        </Button>
      )}
    </div>
  )
}

function BannerIcon({ status }: { status: StreamingStatus }) {
  if (status === "streaming") return <Spinner className="size-3.5" />
  if (status === "error")
    return <XIcon className="size-3.5 text-destructive" />
  if (status === "done")
    return (
      <Check className="size-3.5 text-green-600 dark:text-green-400" />
    )
  return <span className="size-3.5 rounded-full bg-muted-foreground/40" />
}

function bannerLabel(
  status: StreamingStatus,
  phase: StreamStatusPhase | null,
  error: string | null,
): string {
  if (status === "streaming") {
    return phase ? PHASE_LABEL[phase] : "AI is working…"
  }
  if (status === "cancelled") return "Cancelled"
  if (status === "error") return error ?? "Stream failed"
  if (status === "done") return "Done"
  return "Idle"
}
