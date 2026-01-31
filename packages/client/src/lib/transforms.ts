// Data transformation utilities to convert server responses to client types

import type { PRInfo, PRState } from '@/types/pr';
import type { DiffFileData } from '@/components/diff-panel';
import type { ServerPRInfo, ServerFileDiff } from './api';

/**
 * Transform server PR info to client PR info format
 */
export function transformPRInfo(serverPR: ServerPRInfo): PRInfo {
  return {
    number: serverPR.number,
    title: serverPR.title,
    author: {
      login: serverPR.author,
      // Generate GitHub avatar URL from login
      avatarUrl: `https://github.com/${serverPR.author}.png`,
    },
    description: serverPR.description,
    baseBranch: serverPR.baseBranch,
    headBranch: serverPR.headBranch,
    // Server doesn't provide state, default to 'open' for now
    // In a real implementation, we'd need to add state to the server API
    state: 'open' as PRState,
  };
}

/**
 * Map server file status to client file status
 */
function mapFileStatus(status: ServerFileDiff['status']): DiffFileData['status'] {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'deleted';
    case 'modified':
      return 'modified';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Transform server file diff to client DiffFileData format
 */
export function transformFileDiff(serverFile: ServerFileDiff): DiffFileData {
  return {
    path: serverFile.filename,
    status: mapFileStatus(serverFile.status),
    additions: serverFile.additions,
    deletions: serverFile.deletions,
    oldContent: serverFile.baseContent ?? '',
    newContent: serverFile.headContent ?? '',
  };
}

/**
 * Transform array of server file diffs to client format
 */
export function transformFileDiffs(serverFiles: ServerFileDiff[]): DiffFileData[] {
  return serverFiles.map(transformFileDiff);
}
