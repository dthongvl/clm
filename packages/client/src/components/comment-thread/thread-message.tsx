import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Markdown } from "@/components/ui/markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import type { ThreadMessage as ThreadMessageType, Severity } from "@/types/thread"

const severityVariantMap: Record<Severity, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

/**
 * Props for the ThreadMessage component.
 */
export interface ThreadMessageProps extends React.ComponentProps<"div"> {
  /** The message to display */
  message: ThreadMessageType
  /** Whether this is a compact display (less padding) */
  compact?: boolean
}

/**
 * Displays a single message in a thread.
 *
 * Supports:
 * - Human and AI author types with different badges
 * - Severity indicators for AI review items
 * - Streaming state with loading indicator
 * - Markdown content rendering
 *
 * @example
 * ```tsx
 * <ThreadMessage
 *   message={{
 *     id: "1",
 *     content: "This looks like a potential memory leak.",
 *     author: { id: "ai", name: "AI Review", type: "ai" },
 *     severity: "warning",
 *     createdAt: new Date(),
 *   }}
 * />
 * ```
 */
function ThreadMessage({
  message,
  compact = false,
  className,
  ...props
}: ThreadMessageProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(message.createdAt))

  const isAI = message.author.type === "ai"

  return (
    <div
      role="article"
      aria-label={`Message from ${message.author.name}`}
      data-slot="thread-message"
      data-author-type={message.author.type}
      data-streaming={message.isStreaming || undefined}
      className={cn(
        "flex flex-col gap-2",
        isAI
          ? "border-l-2 border-primary/50 bg-primary/5"
          : "border-l-2 border-muted",
        compact ? "pl-2 py-1" : "pl-3 py-2",
        className
      )}
      {...props}
    >
      <div data-slot="message-header" className="flex items-center gap-2">
        <span
          data-slot="message-author"
          className={cn("text-sm font-medium", isAI && "text-primary")}
        >
          {message.author.name}
        </span>
        {isAI && (
          <Badge variant="secondary" className="text-xs" aria-label="AI generated">
            AI
          </Badge>
        )}
        {message.severity && (
          <Badge variant={severityVariantMap[message.severity]}>
            {message.severity}
          </Badge>
        )}
        {message.isStreaming ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-3 animate-spin"
              aria-hidden="true"
            />
            Thinking...
          </span>
        ) : (
          <time
            data-slot="message-timestamp"
            dateTime={new Date(message.createdAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formattedDate}
          </time>
        )}
      </div>
      <div data-slot="message-content">
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-pulse rounded bg-muted" />
            <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <Markdown className="text-sm">{message.content}</Markdown>
        )}
      </div>
    </div>
  )
}

export { ThreadMessage }
