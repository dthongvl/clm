import { Root } from "./root"
import { FileTree } from "./file-tree"
import { Viewer } from "./diff-viewer"

export const DiffPanel = { Root, FileTree, Viewer }
export type { DiffPanelRootProps } from "./root"
export type { DiffPanelFileTreeProps } from "./file-tree"
export type { DiffPanelViewerProps, DiffFileData } from "./diff-viewer"
