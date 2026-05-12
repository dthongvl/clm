import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { ThinkingRow } from "./thinking-row"
import { ToolRow } from "./tool-row"
import { filenameBadge, formatToolInput } from "./tool-helpers"
import { lastNonEmptyLine } from "./utils"
import type { StreamActivity } from "@/hooks/use-ai-review"

const STAGGER_LIMIT = 8
const STAGGER_DELAY_MS = 30

export function ActivityTimeline({
  activities,
  isStreaming,
}: {
  activities: StreamActivity[]
  isStreaming: boolean
}) {
  // Default open while streaming so the user sees what's happening. When the
  // run terminates we auto-collapse to a single summary line so the trace
  // doesn't dominate the review canvas — the user can still expand it. Once
  // the user explicitly toggles the panel, their choice wins until the next
  // run.
  const [open, setOpen] = useState(isStreaming)
  const [userToggled, setUserToggled] = useState(false)
  const wasStreamingRef = useRef(isStreaming)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-collapse on streaming → done transition (unless user toggled).
  useEffect(() => {
    const wasStreaming = wasStreamingRef.current
    wasStreamingRef.current = isStreaming
    if (wasStreaming && !isStreaming && !userToggled) {
      setOpen(false)
    }
    // Re-arm auto-collapse on a fresh run.
    if (!wasStreaming && isStreaming) {
      setUserToggled(false)
      setOpen(true)
    }
  }, [isStreaming, userToggled])

  const handleOpenChange = (next: boolean) => {
    setUserToggled(true)
    setOpen(next)
  }

  useEffect(() => {
    if (!open || !isStreaming || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [activities, open, isStreaming])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const last = activities[activities.length - 1]
  const stepCount = activities.length
  const toolCount = activities.filter((a) => a.kind === "tool").length
  const summary = isStreaming
    ? last
      ? activityPreview(last)
      : "Working…"
    : `Investigated · ${toolCount} tool call${toolCount === 1 ? "" : "s"} · ${stepCount} step${stepCount === 1 ? "" : "s"}`

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        render={
          <button
            type="button"
            aria-label={open ? "Hide agent trace" : "Show agent trace"}
            className="group/header flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          />
        }
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        <span className="shrink-0 rounded-[4px] bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-sm shadow-black/5">
          {stepCount}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        {isStreaming ? (
          <Spinner className="size-3 shrink-0" />
        ) : (
          <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-60">
            {open ? "Hide" : "Show"}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={scrollRef}
          className="ml-[13px] mt-1 max-h-96 overflow-auto border-l-2 border-muted py-0.5 pr-2 pl-3"
        >
          <ul className="flex flex-col gap-0.5">
            {activities.map((activity, index) => (
              <li
                key={activity.id}
                className="animate-in fade-in-0 slide-in-from-left-2 transition-all duration-300 ease-out"
                style={{
                  animationDelay: `${Math.min(index, STAGGER_LIMIT) * STAGGER_DELAY_MS}ms`,
                  animationFillMode: "both",
                }}
              >
                <ActivityRow
                  activity={activity}
                  isExpanded={expandedRows.has(activity.id)}
                  onToggle={() => toggleRow(activity.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ActivityRow({
  activity,
  isExpanded,
  onToggle,
}: {
  activity: StreamActivity
  isExpanded: boolean
  onToggle: () => void
}) {
  if (activity.kind === "thinking") {
    return (
      <ThinkingRow
        activity={activity}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
    )
  }
  return (
    <ToolRow activity={activity} isExpanded={isExpanded} onToggle={onToggle} />
  )
}

function activityPreview(activity: StreamActivity): string {
  if (activity.kind === "thinking") {
    if (activity.status === "running") {
      return lastNonEmptyLine(activity.content) || "Thinking…"
    }
    return lastNonEmptyLine(activity.content) || "Thought"
  }
  const file = filenameBadge(activity.toolName, activity.input)
  const summary = formatToolInput(activity.toolName, activity.input)
  const detail = file ?? summary
  return detail ? `${activity.toolName} · ${detail}` : activity.toolName
}
