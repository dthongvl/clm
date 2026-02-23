import { fetchApi } from './client';
import type { AIReviewCategory, AIReviewRunMode } from '@/types/review';
import type { PatternVerificationResult } from '@/types/verification';

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
  reviewCategories?: AIReviewCategory[];
  runMode?: AIReviewRunMode;
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

export interface ServerRelatedFile {
  filePath: string;
  explanation: string;
}

interface RelatedFilesResponse {
  files: ServerRelatedFile[];
}

export async function findRelatedFiles(additionalContext?: string): Promise<ServerRelatedFile[]> {
  const response = await fetchApi<RelatedFilesResponse>('/ai/related-files', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
  });
  return response.files;
}

export async function verifyPatterns(additionalContext?: string): Promise<PatternVerificationResult> {
  return fetchApi<PatternVerificationResult>('/ai/pattern-verification', {
    method: 'POST',
    body: JSON.stringify(buildAIActionBody(additionalContext)),
  });
}
