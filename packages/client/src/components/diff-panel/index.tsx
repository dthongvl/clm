import { Root } from "./root"
import { FileTree } from "./file-tree"
import { Viewer, DiffViewer } from "./diff-viewer"
import { CollapsibleFileHeader } from "./collapsible-file-header"

export const DiffPanel = { Root, FileTree, Viewer, CollapsibleFileHeader }
export { DiffViewer }
export type { DiffPanelRootProps } from "./root"
export type { DiffPanelFileTreeProps } from "./file-tree"
export type { DiffViewerProps, DiffViewerProps as DiffPanelViewerProps, DiffFileData, DraftAnnotation } from "./diff-viewer"
export type { CollapsibleFileHeaderProps } from "./collapsible-file-header"
