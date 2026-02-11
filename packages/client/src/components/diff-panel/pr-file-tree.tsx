import { useMemo, useState } from "react"
import {
  FileTree,
  FileTreeFolder,
  FileTreeFile,
  FileTreeName,
  FileTreeIcon,
} from "@/components/ai-elements/file-tree"
import {
  buildPRFileTree,
  getDefaultExpandedFolders,
  type PRFileTreeNode,
} from "@/lib/pr-file-tree"
import type { DiffFileData } from "@/types/diff"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FilePlusIcon, FileMinusIcon, FileEditIcon, FileSymlinkIcon, SearchIcon, XIcon } from "lucide-react"

export interface PRFileTreeProps {
  files: DiffFileData[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  className?: string
}

function getFileIcon(status: DiffFileData["status"]) {
  switch (status) {
    case "added":
      return <FilePlusIcon className="size-4 text-green-500" />
    case "deleted":
      return <FileMinusIcon className="size-4 text-red-500" />
    case "renamed":
      return <FileSymlinkIcon className="size-4 text-yellow-500" />
    case "modified":
    default:
      return <FileEditIcon className="size-4 text-blue-500" />
  }
}

function FileTreeNodeRenderer({
  node,
  onSelectFile,
}: {
  node: PRFileTreeNode
  onSelectFile: (path: string) => void
}) {
  if (node.type === "folder") {
    return (
      <FileTreeFolder path={node.path} name={node.name}>
        {node.children.map((child) => (
          <FileTreeNodeRenderer
            key={child.path}
            node={child}
            onSelectFile={onSelectFile}
          />
        ))}
      </FileTreeFolder>
    )
  }

  const { file } = node

  return (
    <FileTreeFile path={node.path} name={node.name} className="flex-nowrap">
      {/* Spacer for alignment with folder chevrons */}
      <span className="size-4 shrink-0" />
      <FileTreeIcon>{getFileIcon(file.status)}</FileTreeIcon>
      <FileTreeName className="flex-1 overflow-visible text-clip whitespace-nowrap">{node.name}</FileTreeName>
      <span className="ml-auto flex shrink-0 gap-1 text-xs text-muted-foreground">
        {file.additions > 0 && (
          <span className="text-green-600">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-600">-{file.deletions}</span>
        )}
      </span>
    </FileTreeFile>
  )
}

export function PRFileTree({
  files,
  selectedPath,
  onSelectFile,
  className,
}: PRFileTreeProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    const query = searchQuery.toLowerCase()
    return files.filter((file) => file.path.toLowerCase().includes(query))
  }, [files, searchQuery])

  const tree = useMemo(() => buildPRFileTree(filteredFiles), [filteredFiles])
  const defaultExpanded = useMemo(
    () => getDefaultExpandedFolders(tree),
    [tree]
  )
  const [expanded, setExpanded] = useState(defaultExpanded)

  // Update expanded state when tree changes (e.g., after filtering)
  useMemo(() => {
    setExpanded(getDefaultExpandedFolders(tree))
  }, [tree])

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="relative shrink-0 border-b p-2">
        <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Filter files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <FileTree
          className="border-0 rounded-none w-max min-w-full"
          selectedPath={selectedPath}
          onSelect={onSelectFile}
          expanded={expanded}
          onExpandedChange={setExpanded}
        >
          {tree.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No files match "{searchQuery}"
            </div>
          ) : (
            tree.map((node) => (
              <FileTreeNodeRenderer
                key={node.path}
                node={node}
                onSelectFile={onSelectFile}
              />
            ))
          )}
        </FileTree>
      </ScrollArea>
    </div>
  )
}
