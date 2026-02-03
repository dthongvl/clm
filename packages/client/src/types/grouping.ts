export type RiskLevel = 'high' | 'medium' | 'low';

export interface ChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: RiskLevel;
  riskReason?: string;
}
