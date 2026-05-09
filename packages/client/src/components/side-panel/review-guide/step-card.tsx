import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Markdown } from "@/components/ui/markdown"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import type { JudgmentThread } from "@/types/review-guide"
import { JudgmentThreadList } from "./judgment-thread-list"

interface StepCardProps {
  index: number
  total: number
  /** "Step 0" overview vs numbered step */
  isOverview?: boolean
  title: string
  rationale?: string
  lookFor?: string
  /** When provided, rendered as a markdown body (used for the overview step). */
  overviewBody?: string
  fileGroup?: string[]
  reviewed: boolean
  active: boolean
  isOffRoute?: boolean
  threads?: JudgmentThread[]
  onToggleReviewed: () => void
  onActivate: () => void
  onReturnToRoute?: () => void
  onFileClick?: (filePath: string) => void
  onPinThread?: (threadId: string) => void
  onUnpinThread?: (threadId: string) => void
  onResolveThread?: (threadId: string) => void
  onUnresolveThread?: (threadId: string) => void
  onReplyToThread?: (
    threadId: string,
    reply: import("@/types/review").ReviewComment
  ) => void
  onJudgmentLineClick?: (filePath: string, lineNumber: number) => void
}

function StepCard({
  index,
  total,
  isOverview = false,
  title,
  rationale,
  lookFor,
  overviewBody,
  fileGroup,
  reviewed,
  active,
  isOffRoute = false,
  threads = [],
  onToggleReviewed,
  onActivate,
  onReturnToRoute,
  onFileClick,
  onPinThread,
  onUnpinThread,
  onResolveThread,
  onUnresolveThread,
  onReplyToThread,
  onJudgmentLineClick,
}: StepCardProps) {
  return (
    <Card
      size="sm"
      data-slot="review-guide-step-card"
      data-active={active || undefined}
      data-reviewed={reviewed || undefined}
      onClick={onActivate}
      className={cn(
        "cursor-pointer transition-colors",
        active && "ring-2 ring-primary/40",
        reviewed && "opacity-80"
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
              {isOverview ? "Step 0" : `Step ${index} of ${total}`}
            </Badge>
            <CardTitle className="truncate">{title}</CardTitle>
          </div>
          <label
            className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={reviewed}
              onCheckedChange={onToggleReviewed}
              aria-label={`Mark "${title}" as reviewed`}
            />
            Reviewed
          </label>
        </div>
        {rationale && (
          <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {overviewBody && (
          <Markdown className="text-xs [&_p]:my-1">{overviewBody}</Markdown>
        )}
        {lookFor && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
            <div className="mb-1 font-medium text-foreground/80">
              What to look at
            </div>
            <Markdown className="text-xs [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
              {lookFor}
            </Markdown>
          </div>
        )}
        {fileGroup && fileGroup.length > 0 && (
          <ul className="space-y-1">
            {fileGroup.map((file) => (
              <li
                key={file}
                className="flex items-center gap-2 text-xs"
                title={file}
              >
                <span className="shrink-0 text-muted-foreground/60">•</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFileClick?.(file)
                  }}
                  className="truncate font-mono text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  {file.split("/").pop() || file}
                </button>
              </li>
            ))}
          </ul>
        )}
        {active && isOffRoute && onReturnToRoute && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>You're viewing a file outside this step.</span>
            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onReturnToRoute()
              }}
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-3"
                data-icon="inline-start"
              />
              Return to recommended step
            </Button>
          </div>
        )}
        {threads.length > 0 &&
          onPinThread &&
          onUnpinThread &&
          onResolveThread &&
          onUnresolveThread &&
          onReplyToThread && (
            <div onClick={(e) => e.stopPropagation()}>
              <JudgmentThreadList
                threads={threads}
                onPin={onPinThread}
                onUnpin={onUnpinThread}
                onResolve={onResolveThread}
                onUnresolve={onUnresolveThread}
                onReply={onReplyToThread}
                onFileLineClick={onJudgmentLineClick}
              />
            </div>
          )}
      </CardContent>
    </Card>
  )
}

export { StepCard }
export type { StepCardProps }
