export interface PatternLocation {
  filePath: string;
  lineNumber: number;
  status: 'updated' | 'missing' | 'suspicious';
  snippet?: string;
}

export interface PatternVerification {
  id: string;
  pattern: string;
  description: string;
  status: 'verified' | 'incomplete' | 'warning';
  details: string;
  locations: PatternLocation[];
}

export interface PatternVerificationResult {
  verifications: PatternVerification[];
  summary: string;
}
