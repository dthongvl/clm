import { useState, useCallback } from 'react';
import type { PatternVerificationResult } from '@/types/verification';
import { verifyPatterns } from '@/lib/api';

interface UsePatternVerificationReturn {
  result: PatternVerificationResult | null;
  isLoading: boolean;
  error: Error | null;
  verify: () => Promise<void>;
}

export function usePatternVerification(): UsePatternVerificationReturn {
  const [result, setResult] = useState<PatternVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await verifyPatterns();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { result, isLoading, error, verify };
}
