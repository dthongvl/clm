import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { ReviewComment, Severity } from "@/types/review"

const severityVariantMap: Record<Severity, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

export interface CommentItemProps extends React.ComponentProps<"div"> {
  comment: ReviewComment
}

function CommentItem({ comment, className, children, ...props }: CommentItemProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(comment.createdAt))

  return (
    <div
      role="comment"
      aria-label={`Comment by ${comment.author.name}`}
      data-slot="comment-item"
      className={cn("flex flex-col gap-2 border-l-2 border-muted pl-3 py-2", className)}
      {...props}
    >
      <div data-slot="comment-header" className="flex items-center gap-2">
        <span data-slot="comment-author" className="text-sm font-medium">
          {comment.author.name}
        </span>
        {comment.author.type === "ai" && (
          <Badge variant="secondary" aria-label="AI generated">
            AI
          </Badge>
        )}
        {comment.severity && (
          <Badge variant={severityVariantMap[comment.severity]}>
            {comment.severity}
          </Badge>
        )}
        <time
          data-slot="comment-timestamp"
          dateTime={new Date(comment.createdAt).toISOString()}
          className="text-xs text-muted-foreground"
        >
          {formattedDate}
        </time>
      </div>
      <div data-slot="comment-content" className="text-sm">
        {comment.content}
      </div>
      {comment.replies.length > 0 && (
        <div data-slot="comment-replies" className="mt-2 flex flex-col gap-2 ml-4">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

export { CommentItem }
