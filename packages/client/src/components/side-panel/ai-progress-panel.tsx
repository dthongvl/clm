import { useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronRight,
  FilePenLine,
  MessageCircleDashed,
  Pencil,
  X as XIcon,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { StreamStatusPhase } from "@/api/ai"
import type { StreamActivity, StreamingStatus } from "@/hooks/use-ai-review"

const PHASE_LABEL: Record<StreamStatusPhase, string> = {
  starting: "Starting…",
  fetching_pr: "Fetching PR…",
  analyzing: "Analyzing…",
  finalizing: "Finalizing…",
}

interface AIProgressPanelProps {
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

function StatusBanner({
  status,
  phase,
  error,
  onCancel,
}: Pick<AIProgressPanelProps, "status" | "phase" | "error" | "onCancel">) {
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
  if (status === "error") return <XIcon className="size-3.5 text-destructive" />
  if (status === "done")
    return <Check className="size-3.5 text-green-600 dark:text-green-400" />
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

function ActivityTimeline({
  activities,
  isStreaming,
}: {
  activities: StreamActivity[]
  isStreaming: boolean
}) {
  // Default open while streaming so the user sees what's happening; on
  // termination we re-mount to a closed default for the next run. We don't sync
  // open ↔ isStreaming via effect — once the user toggles, their choice wins
  // until the next run.
  const [open, setOpen] = useState(isStreaming)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !isStreaming || !containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
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
  const preview = last ? activityPreview(last) : ""
  const stepCount = activities.length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="group/header flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          />
        }
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="shrink-0 rounded-[4px] bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-sm shadow-black/5">
          {stepCount}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{preview}</span>
        {isStreaming && <Spinner className="size-3 shrink-0" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={containerRef}
          className="ml-[13px] mt-1 max-h-96 overflow-y-auto border-l-2 border-muted py-0.5 pr-2 pl-3"
        >
          <ul className="flex flex-col gap-0.5">
            {activities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                isExpanded={expandedRows.has(activity.id)}
                onToggle={() => toggleRow(activity.id)}
              />
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface RowProps {
  isExpanded: boolean
  onToggle: () => void
}

function ActivityRow({
  activity,
  isExpanded,
  onToggle,
}: { activity: StreamActivity } & RowProps) {
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

function ThinkingRow({
  activity,
  isExpanded,
  onToggle,
}: {
  activity: Extract<StreamActivity, { kind: "thinking" }>
} & RowProps) {
  const isRunning = activity.status === "running"
  const lastLine = lastNonEmptyLine(activity.content)
  // Only allow expansion when there's more than the truncated last line to show.
  const expandable = activity.content.trim().length > lastLine.length

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? isExpanded : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-sm py-0.5 text-left text-xs text-foreground/75",
          expandable && "cursor-pointer hover:bg-muted/40",
        )}
      >
        {isRunning ? (
          <Spinner className="size-3.5 shrink-0" />
        ) : (
          <MessageCircleDashed className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {isRunning ? (lastLine || "Thinking…") : (lastLine || "Thought")}
        </span>
        {expandable && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/60 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </button>
      {expandable && isExpanded && (
        <div className="mt-1 mb-1 ml-5 rounded-md border border-foreground/5 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
          {activity.content}
        </div>
      )}
    </li>
  )
}

function ToolRow({
  activity,
  isExpanded,
  onToggle,
}: {
  activity: Extract<StreamActivity, { kind: "tool" }>
} & RowProps) {
  const fileBadge = filenameBadge(activity.toolName, activity.input)
  const inputSummary = formatToolInput(activity.toolName, activity.input)
  const showSummary = !fileBadge && Boolean(inputSummary)
  const expandable = hasExpandableToolDetail(activity)

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? isExpanded : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-sm py-0.5 text-left text-xs text-muted-foreground",
          expandable && "cursor-pointer hover:bg-muted/40",
        )}
      >
        <ToolStatusIcon
          status={activity.status}
          toolName={activity.toolName}
        />
        <span className="shrink-0 font-medium text-foreground/85">
          {activity.toolName}
        </span>
        {fileBadge && (
          <span className="shrink-0 rounded-[4px] bg-background px-1.5 py-0.5 text-[10px] text-foreground/70 shadow-sm shadow-black/5">
            {fileBadge}
          </span>
        )}
        {showSummary && (
          <span className="min-w-0 flex-1 truncate text-muted-foreground/80">
            <span className="opacity-60">· </span>
            {inputSummary}
          </span>
        )}
        {activity.status === "failed" && activity.preview && !isExpanded && (
          <span className="ml-auto shrink-0 rounded-[4px] bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            Error
          </span>
        )}
        {expandable && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/60 transition-transform",
              !showSummary && !fileBadge && "ml-auto",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </button>
      {expandable && isExpanded && <ToolExpandedDetail activity={activity} />}
    </li>
  )
}

function ToolExpandedDetail({
  activity,
}: {
  activity: Extract<StreamActivity, { kind: "tool" }>
}) {
  const inputJson = formatInputAsJson(activity.input)
  return (
    <div className="mt-1 mb-1 ml-5 flex flex-col gap-1">
      {inputJson && (
        <div className="rounded-md border border-foreground/5 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
          {inputJson}
        </div>
      )}
      {activity.preview && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words",
            activity.status === "failed"
              ? "border-destructive/20 bg-destructive/5 text-destructive"
              : "border-foreground/5 bg-muted/30 text-muted-foreground",
          )}
        >
          {activity.preview}
        </div>
      )}
    </div>
  )
}

function hasExpandableToolDetail(
  activity: Extract<StreamActivity, { kind: "tool" }>,
): boolean {
  if (activity.preview && activity.preview.length > 0) return true
  const obj = asRecord(activity.input)
  if (!obj) return typeof activity.input === "string" && activity.input.length > 0
  return Object.keys(obj).length > 0
}

function formatInputAsJson(input: unknown): string {
  if (input == null) return ""
  if (typeof input === "string") return input
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return ""
  }
}

function ToolStatusIcon({
  status,
  toolName,
}: {
  status: "pending" | "ok" | "failed"
  toolName: string
}) {
  if (status === "pending") return <Spinner className="size-3.5 shrink-0" />
  if (status === "failed")
    return <XIcon className="size-3.5 shrink-0 text-destructive" />
  // ok — surface Edit/Write distinctly so file mutations stand out at a glance
  if (toolName === "Edit")
    return <Pencil className="size-3.5 shrink-0 text-foreground/70" />
  if (toolName === "Write")
    return <FilePenLine className="size-3.5 shrink-0 text-foreground/70" />
  return (
    <Check className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
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

function lastNonEmptyLine(text: string): string {
  if (!text) return ""
  const trimmed = text.replace(/\s+$/g, "")
  const idx = trimmed.lastIndexOf("\n")
  const line = (idx >= 0 ? trimmed.slice(idx + 1) : trimmed).trim()
  return truncate(line, 140)
}

function filenameBadge(toolName: string, input: unknown): string | null {
  const obj = asRecord(input)
  if (!obj) return null
  const filePath =
    typeof obj.file_path === "string"
      ? obj.file_path
      : typeof obj.path === "string"
        ? obj.path
        : null
  if (!filePath) return null
  // Only show filename badge for file-y tools — avoids cramming the badge onto
  // unrelated rows that happen to mention a path field.
  const isFileTool =
    toolName === "Read" ||
    toolName === "Edit" ||
    toolName === "Write" ||
    toolName === "Glob" ||
    toolName === "MultiEdit"
  if (!isFileTool) return null
  return filePath.split("/").pop() ?? null
}

function formatToolInput(toolName: string, input: unknown): string {
  const obj = asRecord(input)
  if (obj == null) {
    if (typeof input === "string") return truncate(input, 120)
    return ""
  }

  // Surface the most useful field first as a hint, like craft-agents-oss does.
  const candidate =
    obj.command ??
    obj.query ??
    obj.pattern ??
    obj.url ??
    obj.description ??
    obj.file_path ??
    obj.path
  if (typeof candidate === "string") return truncate(candidate, 120)

  // Edit/Write fall through here when only file_path was set — already shown
  // as a badge, so suppress the JSON dump.
  if (toolName === "Edit" || toolName === "Write" || toolName === "Read") {
    return ""
  }

  try {
    return truncate(JSON.stringify(input), 120)
  } catch {
    return ""
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
