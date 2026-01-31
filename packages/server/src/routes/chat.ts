import { Hono } from 'hono';
import { chatWithAI, checkAIBinary } from '../services/ai.js';
import type { ChatMessage } from '../types/index.js';

const app = new Hono();

// Store chat history in memory (in production, use a database)
const chatHistories: Map<string, ChatMessage[]> = new Map();

// POST /api/chat
// Body: { message: string, sessionId?: string, context?: { diff?: string, filename?: string, line?: number } }
app.post('/', async (c) => {
  const hasAI = await checkAIBinary();
  if (!hasAI) {
    return c.json({ error: 'AI binary not available' }, 503);
  }

  const body = await c.req.json();
  const { message, sessionId = 'default', context } = body;

  if (!message) {
    return c.json({ error: 'message is required' }, 400);
  }

  try {
    // Get or create chat history
    const history = chatHistories.get(sessionId) || [];
    
    // Add user message to history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    history.push(userMessage);

    // Get AI response
    const response = await chatWithAI(message, context);

    // Add AI response to history
    const aiMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    history.push(aiMessage);

    // Save history
    chatHistories.set(sessionId, history);

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
  const history = chatHistories.get(sessionId) || [];
  
  return c.json({ sessionId, messages: history });
});

// DELETE /api/chat/history?sessionId={id}
app.delete('/history', (c) => {
  const sessionId = c.req.query('sessionId') || 'default';
  chatHistories.delete(sessionId);
  
  return c.json({ success: true, message: 'Chat history cleared' });
});

export default app;
