/* eslint-disable react-refresh/only-export-components */
import { Root } from "./root"
import { Viewer, DiffViewer } from "./diff-viewer"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { PRFileTree } from "./pr-file-tree"
import { FileSourceDialog } from "./file-source-dialog"

export const DiffPanel = { Root, Viewer, CollapsibleFileHeader, PRFileTree }
export { DiffViewer, FileSourceDialog }
export type { DiffPanelRootProps } from "./root"
export type { DiffViewerProps, DiffViewerProps as DiffPanelViewerProps, DraftAnnotation, DiffViewerRef } from "./diff-viewer"
export type { DiffFileData } from "@/types/diff"
export type { CollapsibleFileHeaderProps } from "./collapsible-file-header"
export type { PRFileTreeProps } from "./pr-file-tree"
export type { FileSourceDialogProps } from "./file-source-dialog"
