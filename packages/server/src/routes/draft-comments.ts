import { Hono } from 'hono';
import type { DraftComment } from '../types/index.js';

const app = new Hono();

// In-memory storage for draft comments
// In production, this would be stored in a database or session storage
const draftCommentsStore = new Map<number, DraftComment[]>();

// Helper to get draft comments for a PR
function getDraftComments(prNumber: number): DraftComment[] {
  return draftCommentsStore.get(prNumber) ?? [];
}

// Helper to generate unique ID
function generateId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// GET /api/draft-comments?pr={number}
// Fetch all draft comments for a PR
app.get('/', (c) => {
  const prNumber = c.req.query('pr');

  if (!prNumber) {
    return c.json({ error: 'pr query parameter is required' }, 400);
  }

  const comments = getDraftComments(parseInt(prNumber, 10));
  return c.json({ comments });
});

// POST /api/draft-comments
// Add a new draft comment
// Body: { prNumber: number, filePath: string, lineNumber: number, side: 'additions' | 'deletions', content: string, authorName?: string }
app.post('/', async (c) => {
  const body = await c.req.json();
  const { prNumber, filePath, lineNumber, side, content, authorName = 'You' } = body;

  if (!prNumber || !filePath || lineNumber == null || !side || !content) {
    return c.json({
      error: 'prNumber, filePath, lineNumber, side, and content are required',
    }, 400);
  }

  if (side !== 'additions' && side !== 'deletions') {
    return c.json({ error: 'side must be "additions" or "deletions"' }, 400);
  }

  const newComment: DraftComment = {
    id: generateId(),
    prNumber,
    filePath,
    lineNumber,
    side,
    content,
    authorName,
    createdAt: new Date().toISOString(),
  };

  const existingComments = getDraftComments(prNumber);
  draftCommentsStore.set(prNumber, [...existingComments, newComment]);

  return c.json({ success: true, comment: newComment });
});

// DELETE /api/draft-comments/:id?pr={number}
// Delete a specific draft comment
app.delete('/:id', (c) => {
  const id = c.req.param('id');
  const prNumber = c.req.query('pr');

  if (!prNumber) {
    return c.json({ error: 'pr query parameter is required' }, 400);
  }

  const prNum = parseInt(prNumber, 10);
  const existingComments = getDraftComments(prNum);
  const filteredComments = existingComments.filter((comment) => comment.id !== id);

  if (filteredComments.length === existingComments.length) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  draftCommentsStore.set(prNum, filteredComments);
  return c.json({ success: true });
});

// DELETE /api/draft-comments?pr={number}
// Clear all draft comments for a PR (useful when submitting to GitHub)
app.delete('/', (c) => {
  const prNumber = c.req.query('pr');

  if (!prNumber) {
    return c.json({ error: 'pr query parameter is required' }, 400);
  }

  draftCommentsStore.delete(parseInt(prNumber, 10));
  return c.json({ success: true, message: 'All draft comments cleared' });
});

// POST /api/draft-comments/submit?pr={number}
// Submit all draft comments to GitHub (placeholder - just clears for now)
// In a full implementation, this would call the GitHub API to post each comment
app.post('/submit', async (c) => {
  const prNumber = c.req.query('pr');

  if (!prNumber) {
    return c.json({ error: 'pr query parameter is required' }, 400);
  }

  const prNum = parseInt(prNumber, 10);
  const comments = getDraftComments(prNum);

  if (comments.length === 0) {
    return c.json({ success: true, message: 'No draft comments to submit', submitted: 0 });
  }

  // For now, we just store them - actual GitHub submission would happen here
  // The comments remain in memory until the user explicitly clears them or submits to GitHub
  
  return c.json({
    success: true,
    message: `${comments.length} draft comment(s) ready for submission`,
    submitted: comments.length,
    comments,
  });
});

export default app;
