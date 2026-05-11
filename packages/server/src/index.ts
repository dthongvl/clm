import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { fileURLToPath } from 'node:url';
import { configure, getConsoleSink, getAnsiColorFormatter } from '@logtape/logtape';
import { honoLogger } from '@logtape/hono';
import { logger } from './lib/logger.js';
import { AppError, createErrorResponse } from './lib/errors.js';
import { initAppContext, getAppContext } from './lib/app-context.js';
import { loadGhToken } from './lib/github-auth.js';
import { initOctokit } from './lib/octokit.js';
import diffRoutes from './routes/diff.js';
import commentRoutes from './routes/comments.js';
import aiReviewRoutes from './routes/ai-review.js';
import prInfoRoutes from './routes/pr-info.js';
import groupingRoutes from './routes/grouping.js';
import reviewGuideRoutes from './routes/review-guide.js';
import refreshRoutes from './routes/refresh.js';
import settingsRoutes from './routes/settings.js';
import modelsRoutes from './routes/models.js';
import reviewRoutes from './routes/reviews.js';
import viewedFilesRoutes from './routes/viewed-files.js';
import proxyImageRoutes from './routes/proxy-image.js';

initAppContext();
await loadGhToken();
initOctokit();

// Configure LogTape for structured request logging with ANSI colors
const ansiFormatter = getAnsiColorFormatter({
  timestamp: 'time',
  timestampStyle: 'dim',
  levelStyle: 'bold',
  levelColors: {
    trace: null,
    debug: 'cyan',
    info: 'green',
    warning: 'yellow',
    error: 'red',
    fatal: 'magenta',
  },
  categoryStyle: 'dim',
});

await configure({
  sinks: { console: getConsoleSink({ formatter: ansiFormatter }) },
  loggers: [
    { category: ['hono'], sinks: ['console'], lowestLevel: 'info' },
    { category: ['clm'], sinks: ['console'], lowestLevel: 'debug' },
    { category: ['logtape', 'meta'], lowestLevel: 'warning' },
  ],
});

const app = new Hono();

// Middleware - LogTape structured request logger
app.use('*', honoLogger({
  format: 'dev',
  skip: (c) => /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|avif|otf)$/i.test(c.req.path),
}));

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
app.route('/api/ai/review-guide', reviewGuideRoutes);
// API routes — Git/GitHub operations
app.route('/api/git/diff', diffRoutes);
app.route('/api/git/comments', commentRoutes);
app.route('/api/git/pr-info', prInfoRoutes);
app.route('/api/git/refresh', refreshRoutes);
app.route('/api/git/viewed-files', viewedFilesRoutes);
app.route('/api/proxy-image', proxyImageRoutes);

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
const clientDistPath = fileURLToPath(import.meta.resolve('../../client/dist'));
app.use('/*', serveStatic({ root: clientDistPath }));

// Fallback to index.html for client-side routing (non-API routes only)
app.get('*', async (c) => {
  // Return JSON 404 for unknown API routes
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  try {
    const indexPath = fileURLToPath(import.meta.resolve('../../client/dist/index.html'));
    const file = Bun.file(indexPath);
    const content = await file.text();
    return c.html(content);
  } catch {
    return c.json({ error: 'Client not built. Please build the client first.' }, 404);
  }
});

// Error handling - log detailed error info and return structured response
app.onError((err, c) => {
  const path = c.req.path;
  const method = c.req.method;

  // Log with full context
  logger.error(`${method} ${path} failed`, err);

  // Use AppError status code if available, otherwise default to 500
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorResponse = createErrorResponse(err, 'Internal server error');

  // Cast to valid HTTP status code type
  return c.json(errorResponse, statusCode as 500 | 400 | 401 | 403 | 404 | 422 | 503 | 504);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server with random free port (port 0 lets OS assign)
const requestedPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;

const server = Bun.serve({
  port: requestedPort,
  fetch: app.fetch,
  idleTimeout: 60, // Increase idleTimeout to handle long-lived streaming connections
});

const actualPort = server.port;

// Output port in parseable format for CLI to capture
console.log(`__CLM_PORT__:${actualPort}`);

logger.serverStart(actualPort ?? 0);

export { server, actualPort as port };
