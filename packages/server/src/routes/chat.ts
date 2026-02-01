import { Hono } from 'hono';
import { chatWithAI, checkAIBinary } from '../services/ai.js';
import { safeJson } from '../utils/request.js';
import { BoundedArrayStore } from '../utils/bounded-store.js';
import type { ChatMessage } from '../types/index.js';

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

// POST /api/chat
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
    console.error('Chat failed:', error);
    return c.json({ error: 'Chat failed', details: (error as Error).message }, 500);
  }
});

// GET /api/chat/history?sessionId={id}
app.get('/history', (c) => {
  const sessionId = c.req.query('sessionId') || 'default';
  const messages = chatHistories.get(sessionId);
  
  return c.json({ sessionId, messages });
});

// DELETE /api/chat/history?sessionId={id}
app.delete('/history', (c) => {
  const sessionId = c.req.query('sessionId') || 'default';
  chatHistories.delete(sessionId);
  
  return c.json({ success: true, message: 'Chat history cleared' });
});

export default app;
