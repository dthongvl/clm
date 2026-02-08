import { fetchApi } from './client';

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
}

interface GroupingResponse {
  groups: ServerChangeGroup[];
}

interface AIReviewPRResponse {
  items: ServerAIReviewItem[];
  summary: string;
}

export async function generateGrouping(): Promise<ServerChangeGroup[]> {
  const response = await fetchApi<GroupingResponse>('/ai/grouping', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return response.groups;
}

export async function generateAIReview(): Promise<AIReviewPRResponse> {
  const response = await fetchApi<AIReviewPRResponse>('/ai/review/pr', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return response;
}
