import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { logger, createLoggerMiddleware } from './lib/logger.js';
import { initAppContext, getAppContext } from './lib/app-context.js';
import diffRoutes from './routes/diff.js';
import commentRoutes from './routes/comments.js';
import aiReviewRoutes from './routes/ai-review.js';
import prInfoRoutes from './routes/pr-info.js';
import groupingRoutes from './routes/grouping.js';
import relatedFilesRoutes from './routes/related-files.js';
import patternVerificationRoutes from './routes/pattern-verification.js';
import refreshRoutes from './routes/refresh.js';
import settingsRoutes from './routes/settings.js';
import modelsRoutes from './routes/models.js';
import reviewRoutes from './routes/reviews.js';

initAppContext();

const app = new Hono();

// Middleware - custom beautiful logger
app.use('*', createLoggerMiddleware());

// CORS configuration - restrict to known origins
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];

app.use('*', cors({
  origin: (origin) => {
    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin) return null;
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) return origin;
    // Reject unknown origins
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API routes — AI actions
app.route('/api/ai/review', aiReviewRoutes);
app.route('/api/ai/grouping', groupingRoutes);
app.route('/api/ai/related-files', relatedFilesRoutes);
app.route('/api/ai/pattern-verification', patternVerificationRoutes);

// API routes — Git/GitHub operations
app.route('/api/git/diff', diffRoutes);
app.route('/api/git/comments', commentRoutes);
app.route('/api/git/pr-info', prInfoRoutes);
app.route('/api/git/refresh', refreshRoutes);

// API routes — App-level
app.route('/api/reviews', reviewRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/models', modelsRoutes);

// Context endpoint - returns the PR being reviewed
app.get('/api/context', (c) => {
  const ctx = getAppContext();
  return c.json(ctx);
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from client build directory
// This will be the built React app
const clientDistPath = import.meta.resolve('../../client/dist').replace('file://', '');
app.use('/*', serveStatic({ root: clientDistPath }));

// Fallback to index.html for client-side routing (non-API routes only)
app.get('*', async (c) => {
  // Return JSON 404 for unknown API routes
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  
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
  logger.error('Server error', err);
  return c.json({ error: 'Internal server error', details: err.message }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

logger.serverStart(port);

export default {
  port,
  fetch: app.fetch,
};
