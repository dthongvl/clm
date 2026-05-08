import { StatusBanner } from "./status-banner"
import { ActivityTimeline } from "./activity-timeline"
import type { StreamStatusPhase } from "@/api/ai"
import type { StreamActivity, StreamingStatus } from "@/hooks/use-ai-review"

export interface AIProgressPanelProps {
  status: StreamingStatus
  phase: StreamStatusPhase | null
  activities: StreamActivity[]
  error: string | null
  onCancel: () => void
}

/**
 * Live progress surface rendered while a streaming AI review is in flight.
 *
 * Layout:
 *  - Status banner — phase label + spinner + Cancel button.
 *  - Activity timeline — single chronological list interleaving thinking
 *    blocks and tool calls (in the order the agent produced them). Collapsed
 *    by default once the run terminates so finished runs stay tidy; while
 *    streaming, the latest row is shown as the preview so the user can see
 *    progress without expanding.
 *
 * Inspired by craft-agents-oss' TurnCard activity stream, scoped down to our
 * one-shot review flow.
 */
export function AIProgressPanel({
  status,
  phase,
  activities,
  error,
  onCancel,
}: AIProgressPanelProps) {
  const isStreaming = status === "streaming"

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <StatusBanner
        status={status}
        phase={phase}
        error={error}
        onCancel={onCancel}
      />

      {activities.length > 0 && (
        <ActivityTimeline activities={activities} isStreaming={isStreaming} />
      )}
    </div>
  )
}
