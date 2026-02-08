import { Hono } from 'hono';
import { chatWithAI, checkAIBinary } from '../services/ai.js';
import { safeJson } from '../utils/request.js';
import { streamOpencodeResponse } from '../utils/sse.js';
import { BoundedArrayStore } from '../utils/bounded-store.js';
import type { ChatMessage } from '../types/index.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

// Bounded chat history store (max 200 sessions, 100 messages each, 1 hour TTL)
const chatHistories = new BoundedArrayStore<string, ChatMessage>({
  maxKeys: 200,
  maxItemsPerKey: 100,
  ttlMs: 60 * 60 * 1000, // 1 hour
});

interface ChatRequestBody {
  message: string;
  sessionId?: string;
  context?: { diff?: string; filename?: string; line?: number };
}

// POST /api/ai/chat
// Body: { message: string, sessionId?: string, context?: { diff?: string, filename?: string, line?: number } }
app.post('/', async (c) => {
  const hasAI = await checkAIBinary();
  if (!hasAI) {
    return c.json({ error: 'AI binary not available' }, 503);
  }

  const result = await safeJson<ChatRequestBody>(c);
  if (!result.ok) return result.response;
  
  const { message, sessionId = 'default', context } = result.data;

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'message is required and must be a string' }, 400);
  }

  if (message.length > 50000) {
    return c.json({ error: 'message exceeds maximum length of 50000 characters' }, 400);
  }

  try {
    // Add user message to history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    chatHistories.push(sessionId, userMessage);

    // Get AI response
    const response = await chatWithAI(message, context);

    // Add AI response to history
    const aiMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    chatHistories.push(sessionId, aiMessage);

    return c.json({
      response,
      sessionId,
      messageId: aiMessage.id,
    });
  } catch (error) {
    logger.error('Chat failed', error);
    return c.json({ error: 'Chat failed', details: (error as Error).message }, 500);
  }
});

// GET /api/ai/chat/history?sessionId={id}
app.get('/history', (c) => {
  const sessionId = c.req.query('sessionId') || 'default';
  const messages = chatHistories.get(sessionId);
  
  return c.json({ sessionId, messages });
});

// DELETE /api/ai/chat/history?sessionId={id}
app.delete('/history', (c) => {
  const sessionId = c.req.query('sessionId') || 'default';
  chatHistories.delete(sessionId);
  
  return c.json({});
});

interface StreamRequestBody {
  message: string;
  context?: { diff?: string; filename?: string; line?: number };
}

// POST /api/ai/chat/stream
// Body: { message: string, context?: { diff?: string, filename?: string, line?: number } }
// Returns: Server-Sent Events stream
app.post('/stream', async (c) => {
  const result = await safeJson<StreamRequestBody>(c);
  if (!result.ok) return result.response;

  const { message, context } = result.data;

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'message is required and must be a string' }, 400);
  }

  if (message.length > 50000) {
    return c.json({ error: 'message exceeds maximum length of 50000 characters' }, 400);
  }

  // Build prompt with context
  let fullMessage = message;
  if (context) {
    const contextParts: string[] = [];
    if (context.filename) contextParts.push(`File: ${context.filename}`);
    if (context.line) contextParts.push(`Line: ${context.line}`);
    if (context.diff) contextParts.push(`\nDiff:\n\`\`\`\n${context.diff}\n\`\`\``);
    if (contextParts.length > 0) {
      fullMessage = `${contextParts.join('\n')}\n\nQuestion: ${message}`;
    }
  }

  return streamOpencodeResponse(c, fullMessage);
});

// GET /api/ai/chat/stream (alternative for EventSource which only supports GET)
// Query: message (required), filename (optional), line (optional)
app.get('/stream', async (c) => {
  const message = c.req.query('message');

  if (!message) {
    return c.json({ error: 'message query parameter is required' }, 400);
  }

  const decodedMessage = decodeURIComponent(message);
  if (decodedMessage.length > 50000) {
    return c.json({ error: 'message exceeds maximum length of 50000 characters' }, 400);
  }

  const filename = c.req.query('filename');
  const line = c.req.query('line');

  let fullMessage = decodedMessage;
  if (filename || line) {
    const contextParts: string[] = [];
    if (filename) contextParts.push(`File: ${filename}`);
    if (line) contextParts.push(`Line: ${line}`);
    fullMessage = `${contextParts.join('\n')}\n\nQuestion: ${decodedMessage}`;
  }

  return streamOpencodeResponse(c, fullMessage);
});

export default app;
