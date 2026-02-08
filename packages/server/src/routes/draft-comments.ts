import { Hono } from 'hono';
import { safeJson } from '../utils/request.js';
import { BoundedArrayStore } from '../utils/bounded-store.js';
import { getAppContext } from '../lib/app-context.js';
import type { DraftComment } from '../types/index.js';

const app = new Hono();

// Bounded draft comments store (max 500 PRs, 200 comments each, 24 hour TTL)
// Key is "repo:prNumber" to avoid collisions across repos
const draftCommentsStore = new BoundedArrayStore<string, DraftComment>({
  maxKeys: 500,
  maxItemsPerKey: 200,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
});

// Helper to build store key
function buildKey(prNumber: number, repo: string): string {
  return `${repo}:${prNumber}`;
}

// Helper to generate unique ID
function generateId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface DraftCommentBody {
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  authorName?: string;
}

// GET /api/draft-comments
// Fetch all draft comments for a PR
app.get('/', (c) => {
  const { prNumber, repo } = getAppContext();

  const key = buildKey(prNumber, repo);
  const comments = draftCommentsStore.get(key);
  return c.json({ comments });
});

// POST /api/draft-comments
// Add a new draft comment
// Body: { filePath: string, lineNumber: number, side: 'additions' | 'deletions', content: string, authorName?: string }
app.post('/', async (c) => {
  const { prNumber, repo } = getAppContext();

  const result = await safeJson<DraftCommentBody>(c);
  if (!result.ok) return result.response;
  
  const { filePath, lineNumber, side, content, authorName = 'You' } = result.data;

  if (!filePath || typeof filePath !== 'string') {
    return c.json({ error: 'filePath is required and must be a string' }, 400);
  }

  if (typeof lineNumber !== 'number' || lineNumber < 1) {
    return c.json({ error: 'lineNumber must be a positive integer' }, 400);
  }

  if (side !== 'additions' && side !== 'deletions') {
    return c.json({ error: 'side must be "additions" or "deletions"' }, 400);
  }

  if (!content || typeof content !== 'string') {
    return c.json({ error: 'content is required and must be a string' }, 400);
  }

  if (content.length > 10000) {
    return c.json({ error: 'content exceeds maximum length of 10000 characters' }, 400);
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

  const key = buildKey(prNumber, repo);
  const added = draftCommentsStore.push(key, newComment);
  
  if (!added) {
    return c.json({ error: 'Maximum draft comments limit reached for this PR' }, 429);
  }

  return c.json({ comment: newComment });
});

// DELETE /api/draft-comments/:id
// Delete a specific draft comment
app.delete('/:id', (c) => {
  const id = c.req.param('id');
  const { prNumber, repo } = getAppContext();

  const key = buildKey(prNumber, repo);
  const beforeCount = draftCommentsStore.get(key).length;
  const remaining = draftCommentsStore.filter(key, (comment) => comment.id !== id);

  if (remaining.length === beforeCount) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  return c.json({});
});

// DELETE /api/draft-comments
// Clear all draft comments for a PR (useful when submitting to GitHub)
app.delete('/', (c) => {
  const { prNumber, repo } = getAppContext();

  const key = buildKey(prNumber, repo);
  draftCommentsStore.delete(key);
  return c.json({});
});

// POST /api/draft-comments/submit
// Submit all draft comments to GitHub (placeholder - just clears for now)
// In a full implementation, this would call the GitHub API to post each comment
app.post('/submit', async (c) => {
  const { prNumber, repo } = getAppContext();

  const key = buildKey(prNumber, repo);
  const comments = draftCommentsStore.get(key);

  if (comments.length === 0) {
    return c.json({ submitted: 0, comments: [] });
  }

  // For now, we just store them - actual GitHub submission would happen here
  // The comments remain in memory until the user explicitly clears them or submits to GitHub

  return c.json({
    submitted: comments.length,
    comments,
  });
});

export default app;
