import { ChevronRight, MessageCircleDashed } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Markdown } from "@/components/ui/markdown"
import { cn } from "@/lib/utils"
import { looksLikeMarkdown } from "./tool-helpers"
import { lastNonEmptyLine } from "./utils"
import type { RowProps } from "./utils"
import type { StreamActivity } from "@/hooks/use-ai-review"

export function ThinkingRow({
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
          "group/row flex w-full items-center gap-2 rounded-sm py-0.5 text-left text-xs text-foreground/75",
          expandable && "cursor-pointer hover:bg-muted/40",
        )}
      >
        {isRunning ? (
          <Spinner className="size-3.5 shrink-0" />
        ) : (
          <MessageCircleDashed className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", expandable && "group-hover/row:underline")}>
          {isRunning ? lastLine || "Thinking…" : lastLine || "Thought"}
        </span>
        {expandable && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/60 transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </button>
      {expandable && isExpanded && (
        <div className="mt-1 mb-1 ml-5 animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="rounded-md border border-foreground/5 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <ThinkingContent content={activity.content} />
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * Render thinking content as Markdown when it looks like markdown,
 * otherwise fall back to pre-formatted plain text.
 */
function ThinkingContent({ content }: { content: string }) {
  if (looksLikeMarkdown(content)) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
        <Markdown>{content}</Markdown>
      </div>
    )
  }

  return (
    <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
      {content}
    </div>
  )
}
