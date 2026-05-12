import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { NotebookJudgmentThread } from "@/types/review-guide"

interface RegenerateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unresolvedDiscardedCount: number
  pinnedPreservedThreads: NotebookJudgmentThread[]
  onConfirm: () => void
  isRegenerating?: boolean
}

function RegenerateModal({
  open,
  onOpenChange,
  unresolvedDiscardedCount,
  pinnedPreservedThreads,
  onConfirm,
  isRegenerating = false,
}: RegenerateModalProps) {
  const pinnedCount = pinnedPreservedThreads.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate notebook?</DialogTitle>
          <DialogDescription>
            This produces a new notebook. Resolved threads, reviewer-authored
            replies, and pinned threads are preserved; unresolved AI threads
            are discarded. Cell read/check/ack state is reset.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">Unresolved threads to discard</span>
            <span className="font-mono font-medium">{unresolvedDiscardedCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">Pinned threads to preserve</span>
            <span className="font-mono font-medium">{pinnedCount}</span>
          </div>
        </div>

        {pinnedCount > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-medium text-foreground">
              Pinned threads that will survive
            </div>
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border bg-card p-2 text-xs">
              {pinnedPreservedThreads.map((thread) => (
                <li key={thread.id} className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {thread.filePath}:{thread.lineNumber}
                  </span>
                  <span className="line-clamp-2 text-foreground/90">
                    {thread.content}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { RegenerateModal }
