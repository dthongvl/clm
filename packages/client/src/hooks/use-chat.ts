import { useCallback, useState } from 'react';
import type { ChatMessage } from '@/types';

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `This is a mock response to: "${content}"`,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
  };
}
