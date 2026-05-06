import { File } from "@pierre/diffs/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export type FileSourceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  content: string
  resolvedTheme: "dark" | "light"
  refLabel?: string
}

function FileSourceDialog({
  open,
  onOpenChange,
  filePath,
  content,
  resolvedTheme,
  refLabel,
}: FileSourceDialogProps) {
  const fileName = filePath.split("/").pop() || filePath

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[min(96vw,1200px)] max-w-none sm:max-w-none flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="truncate font-medium" title={filePath}>
              {fileName}
            </span>
            {refLabel && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                {refLabel}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          {content === "" ? (
            <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
              This file is empty
            </div>
          ) : (
            <File
              file={{ name: filePath, contents: content }}
              options={{
                theme: { dark: "pierre-dark", light: "pierre-light" },
                themeType: resolvedTheme,
                overflow: "scroll",
                disableFileHeader: true,
              }}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export { FileSourceDialog }
