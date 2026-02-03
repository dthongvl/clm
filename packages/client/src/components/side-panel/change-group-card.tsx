import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Markdown } from "@/components/ui/markdown"
import { RiskBadge } from "@/components/ui/risk-badge"
import type { ChangeGroup } from "@/types/grouping"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ChangeGroupCardProps extends React.ComponentProps<"div"> {
  group: ChangeGroup
  onFileClick?: (filePath: string) => void
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath
}

function ChangeGroupCard({ className, group, onFileClick, ...props }: ChangeGroupCardProps) {
  return (
    <div
      data-slot="change-group-card"
      className={cn("w-full text-left", className)}
      {...props}
    >
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{group.title}</CardTitle>
            {group.riskReason ? (
              <Tooltip>
                <TooltipTrigger>
                  <RiskBadge level={group.riskLevel} />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  {group.riskReason}
                </TooltipContent>
              </Tooltip>
            ) : (
              <RiskBadge level={group.riskLevel} />
            )}
          </div>
          {group.summary && (
            <Markdown className="text-xs text-muted-foreground [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
              {group.summary}
            </Markdown>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-1">
            {group.files.map((file) => (
              <li
                key={file}
                className="flex items-center gap-2 text-xs"
                title={file}
              >
                <span className="shrink-0 text-muted-foreground/60">•</span>
                <button
                  type="button"
                  onClick={() => onFileClick?.(file)}
                  className="truncate font-mono text-muted-foreground hover:text-foreground hover:underline transition-colors text-left"
                >
                  {getFileName(file)}
                </button>
              </li>
            ))}
          </ul>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span>{group.files.length} {group.files.length === 1 ? "file" : "files"}</span>
            <div className="flex gap-2">
              <span className="text-green-600 dark:text-green-500">+{group.totalAdditions}</span>
              <span className="text-red-600 dark:text-red-500">-{group.totalDeletions}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { ChangeGroupCard }
