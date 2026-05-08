import {
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  Pencil,
  X as XIcon,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Markdown } from "@/components/ui/markdown"
import { cn } from "@/lib/utils"
import {
  computeDiffStats,
  filenameBadge,
  formatToolInput,
  formatToolInputDisplay,
  formatToolPreview,
  hasExpandableToolDetail,
} from "./tool-helpers"
import type { RowProps } from "./utils"
import type { StreamActivity } from "@/hooks/use-ai-review"

export function ToolRow({
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
  const diffStats = computeDiffStats(activity.toolName, activity.input)
  const isComplete = activity.status === "ok" || activity.status === "failed"

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? isExpanded : undefined}
        className={cn(
          "group/row flex w-full items-center gap-2 rounded-sm py-0.5 text-left text-xs text-muted-foreground",
          expandable && "cursor-pointer hover:bg-muted/40",
        )}
      >
        <ToolStatusIcon
          status={activity.status}
          toolName={activity.toolName}
        />
        <span
          className={cn(
            "shrink-0 font-medium text-foreground/85",
            expandable && isComplete && "group-hover/row:underline",
          )}
        >
          {activity.toolName}
        </span>
        {/* Diff stats + filename badge cluster */}
        {!diffStats && fileBadge && (
          <span className="shrink-0 rounded-[4px] bg-background px-1.5 py-0.5 text-[10px] text-foreground/70 shadow-sm shadow-black/5">
            {fileBadge}
          </span>
        )}
        {diffStats && (
          <span className="flex items-center gap-1.5 text-[10px] shrink-0">
            {diffStats.deletions > 0 && (
              <span className="rounded-[4px] bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                {diffStats.deletions}
              </span>
            )}
            {diffStats.additions > 0 && (
              <span className="rounded-[4px] bg-green-500/10 px-1.5 py-0.5 font-medium text-green-600 dark:text-green-400">
                {diffStats.additions}
              </span>
            )}
            {fileBadge && (
              <span className="rounded-[4px] bg-background px-1.5 py-0.5 text-[11px] text-foreground/70 shadow-sm shadow-black/5">
                {fileBadge}
              </span>
            )}
          </span>
        )}
        {/* Error badge with tooltip */}
        {activity.status === "failed" && activity.preview && !isExpanded && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="ml-auto shrink-0 rounded-[4px] bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive cursor-default">
                  Error
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px]">
                {activity.preview}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Summary text (flex-1) */}
        {showSummary && (
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-muted-foreground/80",
              expandable && isComplete && "group-hover/row:underline",
            )}
          >
            <span className="opacity-60">· </span>
            {inputSummary}
          </span>
        )}
        {/* Chevron — auto-margin when no summary/error to keep it right-aligned */}
        {expandable && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/60 transition-transform duration-200",
              !showSummary && !(activity.status === "failed" && activity.preview) && "ml-auto",
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
  const input = formatToolInputDisplay(activity.input)
  const output = activity.preview ? formatToolPreview(activity.preview) : null

  return (
    <div className="mt-1 mb-1 ml-5 flex flex-col gap-1.5 animate-in fade-in-0 zoom-in-95 duration-200">
      {/* Input */}
      {input.value && (
        <div className="rounded-md border border-foreground/5 bg-muted/30 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-foreground/5 bg-muted/50 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Input
            </span>
            {input.type === "cli" && (
              <span className="text-[10px] text-muted-foreground/50">command</span>
            )}
          </div>
          <div className="px-3 py-2">
            {input.type === "cli" ? (
              <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-foreground/80">
                <span className="select-none text-green-600 dark:text-green-400">$ </span>
                {input.value.slice(2)}
              </div>
            ) : (
              <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                {input.value}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output */}
      {output && (
        <div
          className={cn(
            "rounded-md border overflow-hidden",
            activity.status === "failed"
              ? "border-destructive/20 bg-destructive/5"
              : "border-foreground/5 bg-muted/30",
          )}
        >
          <div className="flex items-center gap-1.5 border-b border-foreground/5 bg-muted/50 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Output
            </span>
            {output.type === "json" && (
              <span className="text-[10px] text-muted-foreground/50">json</span>
            )}
            {output.type === "markdown" && (
              <span className="text-[10px] text-muted-foreground/50">markdown</span>
            )}
          </div>
          <div className="px-3 py-2">
            {output.type === "markdown" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                <Markdown>{output.value}</Markdown>
              </div>
            ) : (
              <div
                className={cn(
                  "font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words",
                  activity.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {output.value}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ToolStatusIcon({
  status,
  toolName,
}: {
  status: "pending" | "ok" | "failed"
  toolName: string
}) {
  return (
    <span className="relative inline-flex size-3.5 shrink-0 items-center justify-center transition-opacity duration-200">
      {status === "pending" && <Spinner className="size-3.5 shrink-0" />}
      {status === "failed" && (
        <XIcon className="size-3.5 shrink-0 text-destructive" />
      )}
      {status === "ok" && (
        <>
          {toolName === "Edit" ? (
            <Pencil className="size-3.5 shrink-0 text-foreground/70" />
          ) : toolName === "Write" ? (
            <FilePenLine className="size-3.5 shrink-0 text-foreground/70" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
          )}
        </>
      )}
    </span>
  )
}
