import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '@/types';

interface ChatContext {
  diff?: string;
  filename?: string;
  line?: number;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  sendMessage: (content: string, context?: ChatContext) => Promise<void>;
  isStreaming: boolean;
  error: Error | null;
  clearMessages: () => void;
  abortStream: () => void;
}

export function useChatStream(): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (content: string, context?: ChatContext) => {
    // Abort any existing stream
    abortStream();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, context }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            if (eventType === 'done') {
              setIsStreaming(false);
              return;
            }
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: msg.content + parsed.text }
                      : msg
                  )
                );
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Stream was aborted, not an error
        return;
      }
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Error: ${error.message}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [abortStream]);

  const clearMessages = useCallback(() => {
    abortStream();
    setMessages([]);
    setError(null);
  }, [abortStream]);

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearMessages,
    abortStream,
  };
}
