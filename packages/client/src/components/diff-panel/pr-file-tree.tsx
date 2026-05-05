import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import { FileTree, useFileTree } from "@pierre/trees/react"
import {
  themeToTreeStyles,
  type FileTreeRowDecoration,
  type GitStatus,
  type GitStatusEntry,
} from "@pierre/trees"
import type { CSSProperties } from "react"
import type { DiffFileData } from "@/types/diff"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const getMediaQuery = () =>
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null

const subscribeSystemTheme = (cb: () => void) => {
  const mq = getMediaQuery()
  if (!mq) return () => {}
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

const getSystemThemeSnapshot = (): "dark" | "light" =>
  getMediaQuery()?.matches ? "dark" : "light"

export interface PRFileTreeProps {
  files: DiffFileData[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  className?: string
}

function statusToGit(status: DiffFileData["status"]): GitStatus {
  switch (status) {
    case "added":
      return "added"
    case "deleted":
      return "deleted"
    case "renamed":
      return "renamed"
    case "modified":
    default:
      return "modified"
  }
}

export function PRFileTree({
  files,
  selectedPath,
  onSelectFile,
  className,
}: PRFileTreeProps) {
  const { theme } = useTheme()
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeSnapshot
  )
  const resolvedTheme = theme === "system" ? systemTheme : theme
  const themeStyles = useMemo(
    () => themeToTreeStyles({ type: resolvedTheme }) as CSSProperties,
    [resolvedTheme]
  )

  const paths = useMemo(() => files.map((f) => f.path), [files])
  const gitStatus = useMemo<GitStatusEntry[]>(
    () =>
      files.map((f) => ({
        path: f.path,
        status: statusToGit(f.status),
      })),
    [files]
  )

  const fileByPath = useMemo(() => {
    const map = new Map<string, DiffFileData>()
    for (const f of files) map.set(f.path, f)
    return map
  }, [files])

  // Refs so callbacks captured by the model at construction time always read
  // the latest props (`useFileTree` builds the model exactly once).
  const fileByPathRef = useRef(fileByPath)
  const onSelectFileRef = useRef(onSelectFile)
  useLayoutEffect(() => {
    fileByPathRef.current = fileByPath
    onSelectFileRef.current = onSelectFile
  })

  const { model } = useFileTree({
    paths,
    gitStatus,
    flattenEmptyDirectories: true,
    initialExpansion: "open",
    initialSelectedPaths: selectedPath ? [selectedPath] : undefined,
    search: true,
    fileTreeSearchMode: "hide-non-matches",
    density: "compact",
    onSelectionChange: (selected) => {
      if (selected.length === 0) return
      const path = selected[selected.length - 1]
      if (fileByPathRef.current.has(path)) {
        onSelectFileRef.current(path)
      }
    },
    renderRowDecoration: ({ item }): FileTreeRowDecoration | null => {
      if (item.kind !== "file") return null
      const file = fileByPathRef.current.get(item.path)
      if (!file) return null
      const parts: string[] = []
      if (file.additions > 0) parts.push(`+${file.additions}`)
      if (file.deletions > 0) parts.push(`-${file.deletions}`)
      if (parts.length === 0) return null
      return { text: parts.join(" ") }
    },
  })

  // Skip the first run since the model is constructed with these inputs.
  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    model.resetPaths(paths)
    model.setGitStatus(gitStatus)
  }, [model, paths, gitStatus])

  // Sync external selection changes (e.g., URL-driven) into the tree.
  useEffect(() => {
    if (!selectedPath) return
    const item = model.getItem(selectedPath)
    if (item && !item.isSelected()) {
      item.select()
    }
  }, [model, selectedPath])

  return (
    <FileTree
      model={model}
      className={cn("h-full", className)}
      style={themeStyles}
    />
  )
}
