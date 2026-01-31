import { useCallback, useState } from 'react';

interface AICommentContext {
  filePath: string;
  lineNumber: number;
  content: string;
}

interface UseAICommentReturn {
  askAI: (context: AICommentContext) => Promise<string>;
  isLoading: boolean;
}

const mockResponses = [
  "Consider adding error handling for edge cases here. What happens if the input is null or undefined?",
  "This looks like a good candidate for memoization using useMemo or useCallback to prevent unnecessary re-renders.",
  "The logic here could be simplified by extracting this into a separate utility function for better testability.",
  "Have you considered the accessibility implications? Adding proper ARIA attributes would improve screen reader support.",
  "This implementation follows the pattern well. Consider adding unit tests to cover the edge cases.",
];

export function useAIComment(): UseAICommentReturn {
  const [isLoading, setIsLoading] = useState(false);

  const askAI = useCallback(async (context: AICommentContext): Promise<string> => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const randomIndex = Math.floor(Math.random() * mockResponses.length);
    const response = `Re: ${context.filePath}:${context.lineNumber}\n\n${mockResponses[randomIndex]}`;
    
    setIsLoading(false);
    return response;
  }, []);

  return {
    askAI,
    isLoading,
  };
}
