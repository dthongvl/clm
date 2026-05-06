import { type ReactNode } from 'react'
import { useDiff, useViewedFiles } from '@/hooks'
import { useDiffNavigation } from '@/hooks/use-diff-navigation'
import { DiffPanelContext } from './diff-panel-context'

interface DiffPanelProviderProps {
  children: ReactNode
}

/**
 * Provides diff data, navigation, and viewed-file state
 * to all child components (file tree, diff viewer, side panel).
 *
 * Annotation merging is handled by useAnnotations — not this provider.
 */
export function DiffPanelProvider({ children }: DiffPanelProviderProps) {
  const { data: files = [], isLoading: isDiffLoading, error: diffError } = useDiff()
  const { viewedFiles, syncingFiles: syncingViewedFiles, setViewed: setFileViewed } = useViewedFiles()

  const {
    diffContainerRef,
    diffViewerRef,
    selectedFilePath,
    scrollToFile,
    scrollToAnnotation,
    handleFileTreeSelect,
  } = useDiffNavigation()

  return (
    <DiffPanelContext.Provider
      value={{
        files,
        isDiffLoading,
        diffError,
        diffContainerRef,
        diffViewerRef,
        selectedFilePath,
        scrollToFile,
        scrollToAnnotation,
        handleFileTreeSelect,
        viewedFiles,
        syncingViewedFiles,
        setFileViewed,
      }}
    >
      {children}
    </DiffPanelContext.Provider>
  )
}
