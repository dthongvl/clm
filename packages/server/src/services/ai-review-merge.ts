import type { AIReviewItem, AIReviewCategory } from '../types/index.js';

const SEVERITY_PRIORITY: Record<AIReviewItem['severity'], number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Build a deterministic key for a finding based on file path, line number, and normalized message.
 * Used to detect duplicate findings across separate category runs.
 */
export function buildFindingKey(
  item: Pick<AIReviewItem, 'filePath' | 'lineNumber' | 'message'>
): string {
  const normalizedPath = item.filePath.toLowerCase().trim();
  const normalizedMessage = item.message
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  
  return `${normalizedPath}:${item.lineNumber}:${normalizedMessage}`;
}

/**
 * Merge and deduplicate review items from multiple category runs.
 * - Deduplicates by filePath + lineNumber + normalized message
 * - Escalates severity (critical > warning > info)
 * - Unions categories across duplicates
 * - Preserves non-empty suggestion from any duplicate
 * - Maintains first-seen key order for deterministic output
 * - Generates stable IDs (ai-review-1, ai-review-2, ...)
 */
export function mergeReviewItems(items: AIReviewItem[]): AIReviewItem[] {
  if (items.length === 0) return [];

  // Map from key to merged item data
  const mergedMap = new Map<string, {
    filePath: string;
    lineNumber: number;
    severity: AIReviewItem['severity'];
    categories: Set<AIReviewCategory>;
    message: string;
    suggestion?: string;
  }>();
  
  // Track insertion order
  const keyOrder: string[] = [];

  for (const item of items) {
    const key = buildFindingKey(item);
    
    const existing = mergedMap.get(key);
    if (existing) {
      // Escalate severity
      if (SEVERITY_PRIORITY[item.severity] > SEVERITY_PRIORITY[existing.severity]) {
        existing.severity = item.severity;
      }
      
      // Union categories
      for (const cat of item.categories) {
        existing.categories.add(cat);
      }
      
      // Preserve non-empty suggestion
      if (item.suggestion && !existing.suggestion) {
        existing.suggestion = item.suggestion;
      }
    } else {
      // First occurrence - use original values
      mergedMap.set(key, {
        filePath: item.filePath,
        lineNumber: item.lineNumber,
        severity: item.severity,
        categories: new Set(item.categories),
        message: item.message,
        suggestion: item.suggestion,
      });
      keyOrder.push(key);
    }
  }

  // Build result in first-seen order with stable IDs
  const result: AIReviewItem[] = [];
  let idCounter = 1;

  for (const key of keyOrder) {
    const data = mergedMap.get(key)!;
    result.push({
      id: `ai-review-${idCounter++}`,
      filePath: data.filePath,
      lineNumber: data.lineNumber,
      severity: data.severity,
      categories: [...data.categories],
      message: data.message,
      suggestion: data.suggestion,
    });
  }

  return result;
}
