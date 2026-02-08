import { useState, useCallback } from 'react';
import type { PatternVerificationResult } from '@/types/verification';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UsePatternVerificationOptions {
  repo: string;
  prNumber: number;
}

interface UsePatternVerificationReturn {
  result: PatternVerificationResult | null;
  isLoading: boolean;
  error: Error | null;
  verify: () => Promise<void>;
}

export function usePatternVerification({
  repo,
  prNumber,
}: UsePatternVerificationOptions): UsePatternVerificationReturn {
  const [result, setResult] = useState<PatternVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/pattern-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber, repo }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify patterns');
      }

      const data: PatternVerificationResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [repo, prNumber]);

  return { result, isLoading, error, verify };
}
