/**
 * Public surface for GitHub-related operations.
 *
 * Routes import from `../services/github` — never from individual files in
 * this folder — so internal layout changes don't ripple out.
 */
export type { PRComment } from '../../types/index.js';
export type { UpdatedReviewComment } from './reviews.js';

export { checkGhCli, getCurrentRepo, getGhAuthToken } from './gh-cli.js';
export {
  getPRInfo,
  getCurrentUserLogin,
  getPRNodeId,
  getPRHeadSha,
} from './pull-request.js';
export {
  getPRComments,
  postComment,
  replyToComment,
  deleteComment,
  editComment,
} from './comments.js';
export {
  findPendingReview,
  createPendingReview,
  listPendingReviewComments,
  createPendingReviewComment,
  updatePendingReviewComment,
  deletePendingReviewComment,
  submitPendingReview,
} from './reviews.js';
export {
  getPRFileViewedStates,
  setPRFileViewedState,
} from './viewed-files.js';
