export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type VerificationStatus = 'ILLUSTRATIVE' | 'VERIFIED_REFERENCE';

export type ClauseCategory =
  | 'Rent & Escalation'
  | 'Security Deposit'
  | 'Lock-in Period'
  | 'Termination & Notice'
  | 'Eviction & Entry'
  | 'Maintenance & Repairs'
  | 'Penalties & Late Fees'
  | 'Renewal & Holdover'
  | 'Utilities & Other Terms';

export interface RulebookRule {
  id: string;
  title: string;
  category: ClauseCategory | string;
  description: string;
  jurisdiction: string;
  sourceReference: string;
  version: string;
  severityHint: RiskLevel;
  verificationStatus: VerificationStatus;
  enabled: boolean;
  updatedAt: string;
}

export interface RulebookVersion {
  id: string;
  versionLabel: string;
  name: string;
  description: string;
  createdAt: string;
  parentVersionId?: string;
  rules: RulebookRule[];
}

export interface ClauseFinding {
  id: string;
  category: string;
  clauseTitle: string;
  riskLevel: RiskLevel;
  plainEnglish: string;
  whyItMatters: string;
  exactSourceText: string;
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  questionsToAsk: string[];
  recommendation: string;
}

export interface KeyLeaseTerms {
  monthlyRent: string;
  securityDeposit: string;
  leaseDuration: string;
  lockInPeriod: string;
  noticePeriod: string;
  lateFeePolicy: string;
}

export interface RiskCounts {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface TranslatedClauseText {
  id: string;
  category: string;
  clauseTitle: string;
  plainEnglish: string;
  whyItMatters: string;
  questionsToAsk: string[];
  recommendation: string;
}

export interface TranslatedAnalysisPayload {
  language: string;
  executiveSummary: string;
  informationalDisclaimer: string;
  keyTerms: KeyLeaseTerms;
  recommendedActions: string[];
  clauses: TranslatedClauseText[];
  translatedAt: string;
}

export interface AgreementAnalysis {
  id: string;
  agreementId: string;
  title: string;
  fileName: string;
  sourceType: 'pdf' | 'txt' | 'pasted' | 'demo';
  isDemo: boolean;
  isSampleResult: boolean;
  extractedText: string;
  pageCount?: number;
  wordCount: number;
  rulebookVersionId: string;
  rulebookVersionLabel: string;
  rulebookName: string;
  analyzedAt: string;
  language?: string;
  executiveSummary: string;
  informationalDisclaimer: string;
  keyTerms: KeyLeaseTerms;
  riskScore: number;
  riskCounts: RiskCounts;
  recommendedActions?: string[];
  clauses: ClauseFinding[];
  translations?: Record<string, TranslatedAnalysisPayload>;
}

export interface ExtractedDocumentResponse {
  fileName: string;
  sourceType: 'pdf' | 'txt';
  extractedText: string;
  pageCount?: number;
  characterCount: number;
  wordCount: number;
  isScannedOrUnreadable: boolean;
  warningMessage?: string;
}

export interface ClauseDiffItem {
  status: 'NEW_RISK' | 'RESOLVED_RISK' | 'LEVEL_CHANGED' | 'UNCHANGED';
  clauseTitle: string;
  category: string;
  exactSourceText: string;
  before?: ClauseFinding;
  after?: ClauseFinding;
  riskChangeDirection?: 'ESCALATED' | 'REDUCED' | 'SAME';
  changeSummary: string;
}

export interface VersionComparisonResponse {
  agreementId: string;
  agreementTitle: string;
  baselineAnalysis: AgreementAnalysis;
  updatedAnalysis: AgreementAnalysis;
  summary: {
    newlyFlaggedCount: number;
    resolvedCount: number;
    changedLevelCount: number;
    unchangedCount: number;
    highDelta: number;
    mediumDelta: number;
    lowDelta: number;
  };
  diffs: ClauseDiffItem[];
}

export interface ChatSupportingClause {
  clauseTitle: string;
  exactQuote: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  supportingClauses?: ChatSupportingClause[];
  disclaimerNote?: string;
  timestamp: string;
}
