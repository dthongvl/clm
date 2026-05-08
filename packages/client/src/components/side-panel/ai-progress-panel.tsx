import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, X as XIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { StreamStatusPhase } from "@/api/ai"
import type {
  StreamingStatus,
  StreamToolCall,
} from "@/hooks/use-ai-review"

const PHASE_LABEL: Record<StreamStatusPhase, string> = {
  starting: "Starting…",
  fetching_pr: "Fetching PR…",
  analyzing: "Analyzing…",
  finalizing: "Finalizing…",
}

interface AIProgressPanelProps {
  status: StreamingStatus
  phase: StreamStatusPhase | null
  thinking: string
  toolCalls: StreamToolCall[]
  error: string | null
  onCancel: () => void
}

/**
 * Live progress surface rendered while a streaming AI review is in flight.
 *
 * Subsections (each renders only when it has content, so a fast Opencode
 * response with no thinking / tool events shows just the status banner):
 *  - Status banner — phase label + spinner + Cancel button.
 *  - Thinking — collapsible, dimmed monospace, auto-scrolls to the bottom as
 *    deltas arrive; opens by default while streaming, locks to closed once
 *    the run terminates so the user has to opt back in.
 *  - Tool calls — one row per `callId`, status icon flips when the matching
 *    `tool_result` arrives.
 */
export function AIProgressPanel({
  status,
  phase,
  thinking,
  toolCalls,
  error,
  onCancel,
}: AIProgressPanelProps) {
  const isStreaming = status === "streaming"

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <StatusBanner
        status={status}
        phase={phase}
        error={error}
        onCancel={onCancel}
      />

      {thinking.length > 0 && (
        <ThinkingPanel content={thinking} isStreaming={isStreaming} />
      )}

      {toolCalls.length > 0 && <ToolCallList calls={toolCalls} />}
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

function ThinkingPanel({
  content,
  isStreaming,
}: {
  content: string
  isStreaming: boolean
}) {
  // `open` is kept uncontrolled-with-default so we don't sync external state
  // inside an effect. The default tracks `isStreaming` at mount time; the user
  // is in charge of subsequent toggles. Remounting the component (parent goes
  // idle → streaming) gives the next run a fresh default.
  const [open, setOpen] = useState(isStreaming)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the scratchpad as deltas arrive.
  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [content, open])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
          />
        }
      >
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="font-medium">Thinking</span>
        <span className="text-muted-foreground/60">
          {`${content.length} char${content.length === 1 ? "" : "s"}`}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={scrollRef}
          className="mt-1 max-h-48 overflow-y-auto rounded-md border border-foreground/5 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ToolCallList({ calls }: { calls: StreamToolCall[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-2 text-xs font-medium text-muted-foreground">
        Tools
      </div>
      <ul className="flex flex-col gap-1">
        {calls.map((call) => (
          <ToolCallRow key={call.callId} call={call} />
        ))}
      </ul>
    </div>
  )
}

function ToolCallRow({ call }: { call: StreamToolCall }) {
  const inputPreview = formatInputPreview(call.input)
  return (
    <li className="flex items-start gap-2 rounded-md border border-foreground/5 bg-card px-2 py-1.5 text-xs">
      <ToolStatusIcon status={call.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-medium">
            {call.toolName}
          </span>
          {inputPreview && (
            <span className="truncate text-muted-foreground">
              {inputPreview}
            </span>
          )}
        </div>
        {call.preview && (
          <div
            className={cn(
              "truncate font-mono text-[10px]",
              call.status === "failed"
                ? "text-destructive/80"
                : "text-muted-foreground/80",
            )}
          >
            {call.preview}
          </div>
        )}
      </div>
    </li>
  )
}

function ToolStatusIcon({ status }: { status: StreamToolCall["status"] }) {
  if (status === "pending") return <Spinner className="mt-0.5 size-3" />
  if (status === "ok")
    return (
      <Check className="mt-0.5 size-3 text-green-600 dark:text-green-400" />
    )
  return <XIcon className="mt-0.5 size-3 text-destructive" />
}

function formatInputPreview(input: unknown): string {
  if (input == null) return ""
  if (typeof input === "string") return truncate(input, 120)
  if (typeof input !== "object") return truncate(String(input), 120)

  // Common tool input shapes — surface the most useful field as a hint.
  const obj = input as Record<string, unknown>
  const candidate =
    obj.file_path ??
    obj.path ??
    obj.command ??
    obj.query ??
    obj.pattern ??
    obj.url
  if (typeof candidate === "string") return truncate(candidate, 120)

  try {
    return truncate(JSON.stringify(input), 120)
  } catch {
    return ""
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
