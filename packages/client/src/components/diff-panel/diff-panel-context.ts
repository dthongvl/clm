import { createContext, useContext, type MutableRefObject } from 'react'
import type { DiffFileData } from '@/types/diff'

export interface DiffPanelContextValue {
  files: DiffFileData[]
  isDiffLoading: boolean
  diffError: Error | null

  /** Navigation */
  diffContainerRef: MutableRefObject<HTMLDivElement | null>
  diffViewerRef: MutableRefObject<{ expandFile: (filePath: string) => void } | null>
  selectedFilePath: string | undefined
  scrollToFile: (filePath: string) => void
  scrollToAnnotation: (filePath: string, lineNumber: number) => void
  /** Focus a group of files — scrolls to the first; remaining files stay reachable via the file tree. */
  focusFileGroup: (filePaths: string[]) => void
  handleFileTreeSelect: (filePath: string) => void

  /** Viewed files */
  viewedFiles: Set<string>
  syncingViewedFiles: Set<string>
  setFileViewed: (filePath: string, viewed: boolean) => Promise<void>
}

export const DiffPanelContext = createContext<DiffPanelContextValue | null>(null)

export function useDiffPanelContext(): DiffPanelContextValue {
  const ctx = useContext(DiffPanelContext)
  if (!ctx) {
    throw new Error('useDiffPanelContext must be used within a DiffPanelProvider')
  }
  return ctx
}
