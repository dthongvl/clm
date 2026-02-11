import { cn } from "@/lib/utils"
import type { ChangeGroup } from "@/types/grouping"
import { Button } from "@/components/ui/button"
import { ChangeGroupCard } from "./change-group-card"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiGenerativeIcon, Loading03Icon, AlertCircleIcon } from "@hugeicons/core-free-icons"
import { ActionSettingsPopover } from "./action-settings-popover"
import type { ModelOption } from "@/types/settings"

export interface IntelligentGroupingProps extends React.ComponentProps<"div"> {
  groups: ChangeGroup[]
  onFileClick?: (filePath: string) => void
  onGenerateGroups?: () => void
  isGenerating?: boolean
  error?: Error | null
  models?: ModelOption[]
  currentModel?: string
  currentVariant?: string
  onModelChange?: (model: string, variant?: string) => void
}

function IntelligentGrouping({
  className,
  groups,
  onFileClick,
  onGenerateGroups,
  isGenerating = false,
  error,
  models,
  currentModel,
  currentVariant,
  onModelChange,
  ...props
}: IntelligentGroupingProps) {
  return (
    <div
      data-slot="intelligent-grouping"
      aria-busy={isGenerating}
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {onGenerateGroups && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateGroups}
            disabled={isGenerating}
            className="flex-1"
            aria-label={isGenerating ? "Generating groups..." : "Generate AI groupings"}
          >
            <HugeiconsIcon
              icon={isGenerating ? Loading03Icon : AiGenerativeIcon}
              className={cn(isGenerating && "animate-spin")}
              data-icon="inline-start"
            />
            {isGenerating ? "Generating..." : groups.length > 0 ? "Regenerate Groupings" : "Generate AI Groupings"}
          </Button>
          {models && onModelChange && (
            <ActionSettingsPopover
              actionKey="grouping"
              models={models}
              currentModel={currentModel}
              currentVariant={currentVariant}
              onModelChange={onModelChange}
            />
          )}
        </div>
      )}

      {error ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
            <span className="text-sm font-medium">Failed to generate groups</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {error.message}
          </p>
          {onGenerateGroups && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateGroups}
              disabled={isGenerating}
              className="mt-1"
            >
              Try Again
            </Button>
          )}
        </div>
      ) : isGenerating ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-none border border-border bg-muted/50"
              aria-hidden="true"
            />
          ))}
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            AI is analyzing your changes...
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No groups available. Click "Generate AI Groupings" to let AI organize your changes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <ChangeGroupCard
              key={group.id}
              group={group}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export { IntelligentGrouping }
