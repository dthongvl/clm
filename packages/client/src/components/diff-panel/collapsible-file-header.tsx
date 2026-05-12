import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/ui/copy-button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  File01Icon,
} from "@hugeicons/core-free-icons"
import type { FileDiffMetadata } from "@pierre/diffs"
import { FileTypeIcon } from "./file-type-icon"

/** Map Pierre's ChangeTypes to our display status. */
function mapChangeType(type: FileDiffMetadata["type"]):
  | "added"
  | "modified"
  | "deleted"
  | "renamed" {
  switch (type) {
    case "new":
      return "added"
    case "deleted":
      return "deleted"
    case "change":
      return "modified"
    case "rename-pure":
    case "rename-changed":
      return "renamed"
    default:
      return "modified"
  }
}

export interface CollapsibleFileHeaderProps {
  fileDiff: FileDiffMetadata
  isCollapsed: boolean
  isViewed: boolean
  /** Whether viewed state is currently syncing with server */
  isSyncingViewed?: boolean
  onToggleCollapse: () => void
  onToggleViewed: () => void
  /** Callback when the view source button is clicked */
  onViewSource?: () => void
  className?: string
}

function CollapsibleFileHeader({
  fileDiff,
  isCollapsed,
  isViewed,
  isSyncingViewed,
  onToggleCollapse,
  onToggleViewed,
  onViewSource,
  className,
}: CollapsibleFileHeaderProps) {
  const { additions, deletions, status, filePath } = useMemo(() => {
    let additions = 0
    let deletions = 0
    for (const hunk of fileDiff.hunks) {
      additions += hunk.additionLines
      deletions += hunk.deletionLines
    }
    return {
      additions,
      deletions,
      status: mapChangeType(fileDiff.type),
      filePath: fileDiff.name,
    }
  }, [fileDiff])

  const canViewSource = fileDiff.type !== "deleted"

  const handleViewSource = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewSource?.()
  }

  const fileName = filePath.split("/").pop() || filePath
  const dirPath = filePath.includes("/")
    ? filePath.slice(0, filePath.lastIndexOf("/"))
    : ""

  const prevFileName = fileDiff.prevName?.split("/").pop() || fileDiff.prevName
  const prevDirPath =
    fileDiff.prevName != null && fileDiff.prevName.includes("/")
      ? fileDiff.prevName.slice(0, fileDiff.prevName.lastIndexOf("/"))
      : ""

  return (
    <div
      data-slot="collapsible-file-header"
      data-diffs-header="custom"
      data-change-type={fileDiff.type}
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2 backdrop-blur-sm",
        className
      )}
    >
      {/* Left side: collapse toggle, file name, copy button */}
      <div className="group/header flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand file" : "Collapse file"}
          aria-expanded={!isCollapsed}
          className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          {/* File-type icon: shown by default, hidden when the header is hovered. */}
          <FileTypeIcon
            filePath={filePath}
            className="size-4 transition-opacity group-hover/header:opacity-0"
          />
          {/* Chevron: hidden by default, shown on hover (overlays the icon). */}
          <HugeiconsIcon
            icon={isCollapsed ? ArrowRight01Icon : ArrowDown01Icon}
            className="absolute size-4 text-muted-foreground opacity-0 transition-opacity group-hover/header:opacity-100"
          />
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 text-left"
        >
          <span
            className="truncate text-sm font-medium text-foreground"
            title={filePath}
          >
            {fileDiff.prevName != null ? (
              <>
                <span className="opacity-70">{prevFileName}</span>
                {prevDirPath && (
                  <span className="font-normal opacity-50">
                    {" "}
                    {prevDirPath}
                  </span>
                )}
                <span className="mx-1 opacity-50">→</span>
                {fileName}
                {dirPath && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {dirPath}
                  </span>
                )}
              </>
            ) : (
              <>
                {fileName}
                {dirPath && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {dirPath}
                  </span>
                )}
              </>
            )}
          </span>
        </button>

        <CopyButton
          value={filePath}
          size="xs"
          label={`Copy file name: ${fileName}`}
        />
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
          {deletions > 0 || additions === 0 ? (
            <span className="text-red-500">-{deletions}</span>
          ) : null}
          {additions > 0 || deletions === 0 ? (
            <span className="text-green-500">+{additions}</span>
          ) : null}
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
