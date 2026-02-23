import { Hono } from 'hono';
import { safeJson, isPositiveInt } from '../utils/request.js';
import { getAppContext } from '../lib/app-context.js';
import {
  getCurrentUserLogin,
  findPendingReview,
  createPendingReview,
  listPendingReviewComments,
  createPendingReviewComment,
  updatePendingReviewComment,
  deletePendingReviewComment,
  submitPendingReview,
} from '../services/gh.js';
import { AppError, wrapError } from '../lib/errors.js';
import type { SubmitReviewEvent, DraftReviewComment } from '../types/index.js';

const app = new Hono();

interface CreateCommentBody {
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
}

interface UpdateCommentBody {
  content: string;
}

interface SubmitReviewBody {
  event: SubmitReviewEvent;
  body?: string;
}

app.get('/draft', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();
    const login = await getCurrentUserLogin();
    const review = await findPendingReview(prNumber, repo, login);

    if (!review) {
      return c.json({ review: null, comments: [] });
    }

    const comments = await listPendingReviewComments(prNumber, repo, review.id);
    return c.json({ review, comments });
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to fetch draft review');
  }
});

app.post('/draft/comments', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();

    const result = await safeJson<CreateCommentBody>(c);
    if (!result.ok) return result.response;

    const { filePath, lineNumber, side, content } = result.data;

    if (!filePath || typeof filePath !== 'string') {
      return c.json({ error: 'filePath is required and must be a string', code: 'INVALID_INPUT' }, 400);
    }
    if (!isPositiveInt(lineNumber)) {
      return c.json({ error: 'lineNumber must be a positive integer', code: 'INVALID_INPUT' }, 400);
    }
    if (side !== 'additions' && side !== 'deletions') {
      return c.json({ error: 'side must be "additions" or "deletions"', code: 'INVALID_INPUT' }, 400);
    }
    if (!content || typeof content !== 'string') {
      return c.json({ error: 'content is required and must be a string', code: 'INVALID_INPUT' }, 400);
    }
    if (content.length > 10000) {
      return c.json({ error: 'content exceeds maximum length of 10000 characters', code: 'INVALID_INPUT' }, 400);
    }

    const login = await getCurrentUserLogin();
    let review = await findPendingReview(prNumber, repo, login);
    if (!review) {
      review = await createPendingReview(prNumber, repo);
    }

    const comment = await createPendingReviewComment(prNumber, repo, filePath, lineNumber, side, content, review.nodeId);
    return c.json({ comment });
  } catch (error) {
    if (error instanceof AppError && error.code === 'COMMENT_LOCATION_STALE') {
      throw error;
    }
    throw wrapError(error, 'GH_API_ERROR', 'Failed to create comment');
  }
});

app.patch('/draft/comments/:commentId', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();
    const commentId = c.req.param('commentId');

    if (!commentId) {
      return c.json({ error: 'commentId is required', code: 'INVALID_INPUT' }, 400);
    }

    const result = await safeJson<UpdateCommentBody>(c);
    if (!result.ok) return result.response;

    const { content } = result.data;
    if (!content || typeof content !== 'string') {
      return c.json({ error: 'content is required and must be a string', code: 'INVALID_INPUT' }, 400);
    }
    if (content.length > 10000) {
      return c.json({ error: 'content exceeds maximum length of 10000 characters', code: 'INVALID_INPUT' }, 400);
    }

    const login = await getCurrentUserLogin();
    const review = await findPendingReview(prNumber, repo, login);
    if (!review) {
      return c.json({ error: 'No pending review found', code: 'DRAFT_REVIEW_NOT_FOUND' }, 404);
    }

    const comments = await listPendingReviewComments(prNumber, repo, review.id);
    const target = comments.find((cm) => cm.id === commentId);
    if (!target) {
      return c.json({ error: 'Comment does not belong to your pending review', code: 'COMMENT_NOT_EDITABLE' }, 403);
    }

    const updated = await updatePendingReviewComment(target.nodeId, content);
    const comment: DraftReviewComment = {
      ...updated,
      filePath: target.filePath,
      lineNumber: target.lineNumber,
      side: target.side,
    };
    return c.json({ comment });
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to update comment');
  }
});

app.delete('/draft/comments/:commentId', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();
    const commentId = c.req.param('commentId');

    if (!commentId) {
      return c.json({ error: 'commentId is required', code: 'INVALID_INPUT' }, 400);
    }

    const login = await getCurrentUserLogin();
    const review = await findPendingReview(prNumber, repo, login);
    if (!review) {
      return c.json({ error: 'No pending review found', code: 'DRAFT_REVIEW_NOT_FOUND' }, 404);
    }

    const comments = await listPendingReviewComments(prNumber, repo, review.id);
    const target = comments.find((cm) => cm.id === commentId);
    if (!target) {
      return c.json({ error: 'Comment does not belong to your pending review', code: 'COMMENT_NOT_EDITABLE' }, 403);
    }

    await deletePendingReviewComment(target.nodeId);
    return c.json({});
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to delete comment');
  }
});

app.post('/draft/submit', async (c) => {
  try {
    const { prNumber, repo } = getAppContext();

    const result = await safeJson<SubmitReviewBody>(c);
    if (!result.ok) return result.response;

    const { event, body } = result.data;
    const validEvents: SubmitReviewEvent[] = ['COMMENT', 'REQUEST_CHANGES', 'APPROVE'];
    if (!validEvents.includes(event)) {
      return c.json({ error: 'event must be COMMENT, REQUEST_CHANGES, or APPROVE', code: 'INVALID_INPUT' }, 400);
    }

    const login = await getCurrentUserLogin();
    const review = await findPendingReview(prNumber, repo, login);
    if (!review) {
      return c.json({ error: 'No pending review found', code: 'DRAFT_REVIEW_NOT_FOUND' }, 404);
    }

    const comments = await listPendingReviewComments(prNumber, repo, review.id);
    const hasComments = comments.length > 0;
    const hasBody = typeof body === 'string' && body.trim().length > 0;

    if (event === 'COMMENT' && !hasComments && !hasBody) {
      return c.json({
        error: 'COMMENT reviews require at least one inline comment or a non-empty body',
        code: 'EMPTY_REVIEW_SUBMISSION',
      }, 400);
    }

    await submitPendingReview(prNumber, repo, review.nodeId, event, body);
    return c.json({ submitted: true });
  } catch (error) {
    throw wrapError(error, 'GH_API_ERROR', 'Failed to submit review');
  }
});

export default app;
