import { useState, useCallback, useEffect, useRef } from "react"

interface UseFileViewStateOptions {
  /**
   * Set of file paths marked as viewed.
   * When provided, the hook operates in controlled mode — the parent owns viewed state.
   */
  controlledViewedFiles?: Set<string>
  /**
   * Default set of viewed files for uncontrolled mode.
   * @default new Set()
   */
  defaultViewedFiles?: Set<string>
  /** Callback when a file's viewed state changes */
  onFileViewedChange?: (filePath: string, isViewed: boolean) => void
}

/**
 * Manages viewed and collapsed file state with controlled/uncontrolled mode support.
 *
 * Features:
 * - Controlled mode: parent provides `controlledViewedFiles` and owns the viewed state
 * - Uncontrolled mode: internal state tracks viewed files via `defaultViewedFiles`
 * - Auto-collapse: files marked as viewed are automatically collapsed
 * - Stable `handleToggleCollapse` callback (never changes)
 *
 * @example
 * ```tsx
 * // Uncontrolled
 * const { viewedFiles, collapsedFiles, handleToggleCollapse, handleToggleViewed } =
 *   useFileViewState({ defaultViewedFiles: new Set(["src/a.ts"]) })
 *
 * // Controlled
 * const { viewedFiles, collapsedFiles, handleToggleCollapse, handleToggleViewed } =
 *   useFileViewState({ controlledViewedFiles: viewedFiles, onFileViewedChange: setViewed })
 * ```
 */
export function useFileViewState({
  controlledViewedFiles,
  defaultViewedFiles,
  onFileViewedChange,
}: UseFileViewStateOptions) {
  // Start with viewed files collapsed
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(
    () => new Set(controlledViewedFiles ?? defaultViewedFiles ?? [])
  )

  // Internal viewed files state (used when not controlled)
  const [internalViewedFiles, setInternalViewedFiles] = useState<Set<string>>(
    () => defaultViewedFiles ?? new Set()
  )

  // Determine which viewed-files source to use
  const isControlled = controlledViewedFiles !== undefined
  const viewedFiles = isControlled ? controlledViewedFiles : internalViewedFiles

  // Auto-collapse files that become viewed (e.g. from controlled parent updates)
  const prevViewedRef = useRef(viewedFiles)
  useEffect(() => {
    const prev = prevViewedRef.current
    if (viewedFiles !== prev) {
      const newlyViewed = [...viewedFiles].filter((f) => !prev.has(f))
      if (newlyViewed.length > 0) {
        setCollapsedFiles((c) => {
          const next = new Set(c)
          for (const f of newlyViewed) next.add(f)
          return next
        })
      }
      prevViewedRef.current = viewedFiles
    }
  }, [viewedFiles])

  /** Toggle collapse/expand for a single file. Stable reference. */
  const handleToggleCollapse = useCallback((filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }, [])

  /** Toggle viewed state for a single file. Re-created when viewedFiles changes. */
  const handleToggleViewed = useCallback(
    (filePath: string) => {
      const newViewedState = !viewedFiles.has(filePath)

      // Update internal state if not controlled
      if (!isControlled) {
        setInternalViewedFiles((prev) => {
          const next = new Set(prev)
          if (newViewedState) {
            next.add(filePath)
          } else {
            next.delete(filePath)
          }
          return next
        })
      }

      // Auto-collapse when marking as viewed
      if (newViewedState) {
        setCollapsedFiles((prev) => {
          const next = new Set(prev)
          next.add(filePath)
          return next
        })
      }

      // Notify parent if callback provided
      onFileViewedChange?.(filePath, newViewedState)
    },
    [viewedFiles, isControlled, onFileViewedChange]
  )

  return {
    /** Current viewed files (controlled or internal) */
    viewedFiles,
    /** Currently collapsed file paths */
    collapsedFiles,
    /** Direct state setter for collapsed files (used by imperative expandFile) */
    setCollapsedFiles,
    /** Toggle collapse/expand for a single file */
    handleToggleCollapse,
    /** Toggle viewed state for a single file */
    handleToggleViewed,
  }
}
