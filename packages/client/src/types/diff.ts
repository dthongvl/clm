export interface DiffFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'added' | 'deleted';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Data structure representing a file diff with full content.
 * Used by the diff viewer and data-fetching hooks.
 */
export interface DiffFileData {
  /** The file path */
  path: string
  /** The old file path (for renamed files) */
  oldPath?: string
  /** The status of the file change */
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** The old file content */
  oldContent: string
  /** The new file content */
  newContent: string
}
