import { fetchApi } from './client';
import type { AIReviewCategory } from '@/types/review';


export interface ServerChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: 'high' | 'medium' | 'low';
  riskReason?: string;
}

export interface ServerAIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  categories?: AIReviewCategory[];
}

export interface AIReviewPRResponse {
  items: ServerAIReviewItem[];
  summary: string;
}

interface GroupingResponse {
  groups: ServerChangeGroup[];
}

interface AIReviewRequestBody {
  additionalContext?: string;
}

function buildAIActionBody(additionalContext?: string) {
  return additionalContext ? { additionalContext } : {};
}

export async function generateGrouping(additionalContext?: string): Promise<ServerChangeGroup[]> {
  const response = await fetchApi<GroupingResponse>('/ai/grouping', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
  });
  return response.groups;
}

export async function generateAIReview(body: AIReviewRequestBody = {}): Promise<AIReviewPRResponse> {
  return fetchApi<AIReviewPRResponse>('/ai/review/pr', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}


