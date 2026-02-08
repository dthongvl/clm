// Data transformation utilities to convert server responses to client types

import type { PRInfo, PRState } from '@/types/pr';
import type { DiffFileData } from '@/types/diff';
import type { ReviewComment, AIReviewItem, CommentSide } from '@/types/review';
import type { ChangeGroup } from '@/types/grouping';
import type { ServerPRInfo, ServerFileDiff, ServerPRComment, ServerAIReviewItem, ServerChangeGroup } from './api';

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

/**
 * Map GitHub's LEFT/RIGHT side to client's deletions/additions
 * - LEFT = old code (deletions side in split view)
 * - RIGHT = new code (additions side in split view)
 */
function mapCommentSide(side?: 'LEFT' | 'RIGHT'): CommentSide {
  return side === 'LEFT' ? 'deletions' : 'additions';
}

/**
 * Transform a single server PR comment to client ReviewComment format
 */
export function transformComment(serverComment: ServerPRComment): ReviewComment {
  return {
    id: String(serverComment.id),
    filePath: serverComment.path || '',
    lineNumber: serverComment.line || serverComment.original_line || 0,
    side: mapCommentSide(serverComment.side),
    content: serverComment.body,
    author: {
      type: 'human',
      name: serverComment.user.login,
      avatarUrl: serverComment.user.avatar_url,
    },
    createdAt: new Date(serverComment.created_at),
    replies: [],
    resolved: false,
  };
}

/**
 * Transform array of server PR comments to client ReviewComment format
 * Groups replies with their parent comments
 */
export function transformComments(serverComments: ServerPRComment[]): ReviewComment[] {
  // Separate top-level comments from replies
  const topLevelComments: ServerPRComment[] = [];
  const repliesByParentId = new Map<number, ServerPRComment[]>();

  for (const comment of serverComments) {
    if (comment.in_reply_to_id) {
      const replies = repliesByParentId.get(comment.in_reply_to_id) || [];
      replies.push(comment);
      repliesByParentId.set(comment.in_reply_to_id, replies);
    } else {
      topLevelComments.push(comment);
    }
  }

  // Transform top-level comments and attach their replies
  return topLevelComments.map((comment) => {
    const transformed = transformComment(comment);
    const replies = repliesByParentId.get(comment.id) || [];
    transformed.replies = replies
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(transformComment);
    return transformed;
  });
}

/**
 * Transform a server AI review item to client AIReviewItem format
 */
export function transformAIReviewItem(item: ServerAIReviewItem): AIReviewItem {
  return {
    id: item.id,
    filePath: item.filePath,
    lineNumber: item.lineNumber,
    severity: item.severity,
    message: item.message,
    suggestion: item.suggestion,
  };
}

/**
 * Transform array of server AI review items to client format
 */
export function transformAIReviewItems(items: ServerAIReviewItem[]): AIReviewItem[] {
  return items.map(transformAIReviewItem);
}

/**
 * Transform a server change group to client ChangeGroup format
 */
export function transformChangeGroup(group: ServerChangeGroup): ChangeGroup {
  return {
    id: group.id,
    title: group.title,
    summary: group.summary,
    files: group.files,
    totalAdditions: group.totalAdditions,
    totalDeletions: group.totalDeletions,
    riskLevel: group.riskLevel,
    riskReason: group.riskReason,
  };
}

/**
 * Transform array of server change groups to client format
 */
export function transformChangeGroups(groups: ServerChangeGroup[]): ChangeGroup[] {
  return groups.map(transformChangeGroup);
}
