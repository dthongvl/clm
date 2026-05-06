import { useDiffPanelContext } from './diff-panel-context'
import { DiffPanel } from './index'

/**
 * File tree that consumes diff data and navigation from DiffPanelContext.
 * Intended as the left panel in MainLayout.
 */
export function DiffPanelFileTree({ className }: { className?: string }) {
  const { files, selectedFilePath, handleFileTreeSelect } = useDiffPanelContext()

  return (
    <DiffPanel.PRFileTree
      files={files}
      selectedPath={selectedFilePath}
      onSelectFile={handleFileTreeSelect}
      className={className}
    />
  )
}
