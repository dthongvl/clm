import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Copy01Icon,
  Tick02Icon,
  File01Icon,
} from "@hugeicons/core-free-icons"

export interface CollapsibleFileHeaderProps {
  filePath: string
  status: "added" | "modified" | "deleted" | "renamed"
  additions: number
  deletions: number
  isCollapsed: boolean
  isViewed: boolean
  /** Whether viewed state is currently syncing with server */
  isSyncingViewed?: boolean
  onToggleCollapse: () => void
  onToggleViewed: () => void
  /** Whether the view source action is available */
  canViewSource?: boolean
  /** Callback when the view source button is clicked */
  onViewSource?: () => void
  className?: string
}

function CollapsibleFileHeader({
  filePath,
  status,
  additions,
  deletions,
  isCollapsed,
  isViewed,
  isSyncingViewed,
  onToggleCollapse,
  onToggleViewed,
  canViewSource = true,
  onViewSource,
  className,
}: CollapsibleFileHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyFileName = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(filePath)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleViewSource = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewSource?.()
  }

  const fileName = filePath.split("/").pop() || filePath

  return (
    <div
      data-slot="collapsible-file-header"
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2 backdrop-blur-sm",
        className
      )}
    >
      {/* Left side: collapse toggle, file name, copy button */}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand file" : "Collapse file"}
          aria-expanded={!isCollapsed}
          className="shrink-0"
        >
          <HugeiconsIcon
            icon={isCollapsed ? ArrowRight01Icon : ArrowDown01Icon}
            className="size-4 text-muted-foreground transition-transform"
          />
        </Button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="min-w-0 text-left hover:underline"
        >
          <span
            className="truncate text-sm font-medium text-foreground"
            title={filePath}
          >
            {filePath}
          </span>
        </button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopyFileName}
          aria-label={copied ? "Copied!" : `Copy file name: ${fileName}`}
          title={copied ? "Copied!" : "Copy file path"}
          className="shrink-0"
        >
          <HugeiconsIcon
            icon={copied ? Tick02Icon : Copy01Icon}
            className={cn(
              "size-3.5",
              copied ? "text-green-500" : "text-muted-foreground"
            )}
          />
        </Button>
      </div>

      {/* Right side: diff stats and viewed checkbox */}
      <div className="flex shrink-0 items-center gap-3">
        {/* View file button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewSource}
          disabled={!canViewSource}
          aria-label="View file source"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={File01Icon} className="mr-1 size-3.5" />
          View file
        </Button>

        {/* File status badge */}
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium",
            status === "added" && "bg-green-500/20 text-green-600",
            status === "deleted" && "bg-red-500/20 text-red-600",
            status === "modified" && "bg-blue-500/20 text-blue-600",
            status === "renamed" && "bg-yellow-500/20 text-yellow-600"
          )}
        >
          {status}
        </span>

        {/* Diff stats */}
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {additions > 0 && (
            <span className="text-green-500">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-red-500">-{deletions}</span>
          )}
        </div>

        {/* Viewed checkbox */}
        <label
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            isSyncingViewed ? "cursor-wait opacity-60" : "cursor-pointer"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isViewed}
            onCheckedChange={onToggleViewed}
            disabled={isSyncingViewed}
            className="size-3.5"
          />
          <span>{isSyncingViewed ? "Syncing..." : "Viewed"}</span>
        </label>
      </div>
    </div>
  )
}

export { CollapsibleFileHeader }
