import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { RelatedFile } from "@/types"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiGenerativeIcon, AlertCircleIcon, File01Icon } from "@hugeicons/core-free-icons"
import { ActionSettingsPopover } from "./action-settings-popover"
import { ActionTriggerWithContext } from "./action-trigger-with-context"
import { FileSourceDialog } from "@/components/diff-panel/file-source-dialog"
import { useTheme } from "@/components/theme-provider"
import { fetchFileContent } from "@/api/diff"
import type { ModelOption } from "@/types/settings"

export interface RelatedFilesProps extends React.ComponentProps<"div"> {
  files: RelatedFile[]
  onFileClick?: (filePath: string) => void
  onFindFiles?: (additionalContext?: string) => Promise<boolean>
  isLoading?: boolean
  error?: Error | null
  models?: ModelOption[]
  currentModel?: string
  currentVariant?: string
  onModelChange?: (model: string, variant?: string) => void
}

function RelatedFiles({
  className,
  files,
  onFileClick,
  onFindFiles,
  isLoading = false,
  error,
  models,
  currentModel,
  currentVariant,
  onModelChange,
  ...props
}: RelatedFilesProps) {
  const { theme } = useTheme()
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme

  const [sourceView, setSourceView] = useState<{ filePath: string; content: string } | null>(null)
  const [isFetchingContent, setIsFetchingContent] = useState(false)

  const handleFileClick = useCallback(async (filePath: string) => {
    onFileClick?.(filePath)

    setIsFetchingContent(true)
    try {
      const result = await fetchFileContent(filePath)
      setSourceView({
        filePath,
        content: result.head.content ?? result.base.content ?? "",
      })
    } catch (err) {
      console.error("Failed to fetch file content:", err)
    } finally {
      setIsFetchingContent(false)
    }
  }, [onFileClick])

  const handleSourceDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setSourceView(null)
  }, [])

  return (
    <div
      data-slot="related-files"
      aria-busy={isLoading}
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {onFindFiles && (
        <div className="flex gap-2">
          <ActionTriggerWithContext
            label={files.length > 0 ? "Refresh Related Files" : "Find Related Files"}
            loadingLabel="Finding..."
            ariaLabel="Find related files"
            isLoading={isLoading}
            icon={AiGenerativeIcon}
            onRun={onFindFiles}
          />
          {models && onModelChange && (
            <ActionSettingsPopover
              actionKey="related-files"
              models={models}
              currentModel={currentModel}
              currentVariant={currentVariant}
              onModelChange={onModelChange}
            />
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        AI discovers files in the repository that are related to the current changes but weren't modified — helping you spot missing updates and understand the broader impact of the PR.
      </p>

      {error ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
            <span className="text-sm font-medium">Failed to find related files</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {error.message}
          </p>
          {onFindFiles && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFindFiles()}
              disabled={isLoading}
              className="mt-1"
            >
              Try Again
            </Button>
          )}
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-none border border-border bg-muted/50"
              aria-hidden="true"
            />
          ))}
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            AI is analyzing the codebase...
          </p>
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No related files found. Click "Find Related Files" to let AI discover files related to this PR.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((file, index) => (
            <RelatedFileCard
              key={file.filePath}
              file={file}
              index={index + 1}
              disabled={isFetchingContent}
              onClick={() => handleFileClick(file.filePath)}
            />
          ))}
        </div>
      )}

      <FileSourceDialog
        open={sourceView !== null}
        onOpenChange={handleSourceDialogOpenChange}
        filePath={sourceView?.filePath ?? ""}
        content={sourceView?.content ?? ""}
        resolvedTheme={resolvedTheme}
      />
    </div>
  )
}

interface RelatedFileCardProps extends React.ComponentProps<"button"> {
  file: RelatedFile
  index: number
}

function RelatedFileCard({ file, index, className, ...props }: RelatedFileCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col gap-2 rounded-none border border-border bg-card p-3 text-left transition-colors hover:bg-accent",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </span>
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <HugeiconsIcon icon={File01Icon} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="break-all font-mono text-sm">{file.filePath}</span>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
        {file.explanation}
      </p>
    </button>
  )
}

export { RelatedFiles }
