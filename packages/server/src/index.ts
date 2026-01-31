import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import diffRoutes from './routes/diff.js';
import commentRoutes from './routes/comments.js';
import aiReviewRoutes from './routes/ai-review.js';
import prInfoRoutes from './routes/pr-info.js';
import chatRoutes from './routes/chat.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API routes
app.route('/api/diff', diffRoutes);
app.route('/api/comments', commentRoutes);
app.route('/api/ai-review', aiReviewRoutes);
app.route('/api/pr-info', prInfoRoutes);
app.route('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from client build directory
// This will be the built React app
const clientDistPath = import.meta.resolve('../../client/dist').replace('file://', '');
app.use('/*', serveStatic({ root: clientDistPath }));

// Fallback to index.html for client-side routing
app.get('*', async (c) => {
  try {
    const indexPath = import.meta.resolve('../../client/dist/index.html').replace('file://', '');
    const file = Bun.file(indexPath);
    const content = await file.text();
    return c.html(content);
  } catch {
    return c.json({ error: 'Client not built. Please build the client first.' }, 404);
  }
});

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(`Server starting on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
