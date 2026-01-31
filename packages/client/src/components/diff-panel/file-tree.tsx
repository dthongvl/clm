import { useCallback, useRef } from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import type { DiffFile } from "@/types/diff"

const fileItemVariants = cva(
  "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
  {
    variants: {
      selected: {
        true: "bg-muted",
        false: "",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
)

const statusIconVariants = cva("size-4 shrink-0 font-mono text-xs font-medium", {
  variants: {
    status: {
      added: "text-green-500",
      modified: "text-yellow-500",
      deleted: "text-red-500",
      renamed: "text-blue-500",
    },
  },
})

const statusIcons: Record<DiffFile["status"], string> = {
  added: "+",
  modified: "~",
  deleted: "−",
  renamed: "→",
}

export interface DiffPanelFileTreeProps {
  files: DiffFile[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  className?: string
}

function FileTree({
  files,
  selectedPath,
  onSelectFile,
  className,
}: DiffPanelFileTreeProps) {
  const listRef = useRef<HTMLUListElement>(null)

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      const items = listRef.current?.querySelectorAll('[role="treeitem"]')
      if (!items?.length) return

      const currentIndex = Array.from(items).findIndex(
        (item) => item === document.activeElement
      )

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault()
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
          ;(items[nextIndex] as HTMLElement).focus()
          break
        }
        case "ArrowUp": {
          event.preventDefault()
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
          ;(items[prevIndex] as HTMLElement).focus()
          break
        }
        case "Enter":
        case " ": {
          event.preventDefault()
          const focusedItem = document.activeElement as HTMLElement
          const path = focusedItem?.dataset.path
          if (path) onSelectFile(path)
          break
        }
        case "Home": {
          event.preventDefault()
          ;(items[0] as HTMLElement).focus()
          break
        }
        case "End": {
          event.preventDefault()
          ;(items[items.length - 1] as HTMLElement).focus()
          break
        }
      }
    },
    [onSelectFile]
  )

  return (
    <nav aria-label="Changed files" className={cn("overflow-auto", className)}>
      <ul
        ref={listRef}
        role="tree"
        onKeyDown={handleKeyDown}
        className="flex flex-col"
      >
        {files.map((file) => (
          <li
            key={file.path}
            role="treeitem"
            tabIndex={selectedPath === file.path ? 0 : -1}
            aria-selected={selectedPath === file.path}
            data-path={file.path}
            onClick={() => onSelectFile(file.path)}
            className={cn(
              fileItemVariants({ selected: selectedPath === file.path })
            )}
          >
            <span
              className={cn(statusIconVariants({ status: file.status }))}
              aria-label={file.status}
            >
              {statusIcons[file.status]}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              {file.path}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {file.additions > 0 && (
                <span className="text-green-500">+{file.additions}</span>
              )}
              {file.additions > 0 && file.deletions > 0 && " "}
              {file.deletions > 0 && (
                <span className="text-red-500">−{file.deletions}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { FileTree }
