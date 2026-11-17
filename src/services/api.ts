import type {
  AgreementAnalysis,
  ExtractedDocumentResponse,
  RulebookRule,
  RulebookVersion,
  TranslatedAnalysisPayload,
  VersionComparisonResponse,
} from '../types/rental.ts';

async function handleJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      throw new Error('Server returned an unexpected non-JSON response.');
    }
  }
  if (!res.ok) {
    throw new Error(
      (data as { error?: string })?.error || `Request failed (${res.status})`
    );
  }
  return data as T;
}

export interface DashboardData {
  totalAgreementsAnalyzed: number;
  riskTotals: { high: number; medium: number; low: number };
  analyses: AgreementAnalysis[];
  rulebooks: RulebookVersion[];
}

export interface DemoPayload {
  agreementId: string;
  title: string;
  fileName: string;
  text: string;
  sampleAnalysis: AgreementAnalysis;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  return handleJson<DashboardData>(res);
}

export async function fetchDemoAgreement(): Promise<DemoPayload> {
  const res = await fetch('/api/demo');
  return handleJson<DemoPayload>(res);
}

export async function extractDocumentFile(file: File): Promise<ExtractedDocumentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/agreements/extract', {
    method: 'POST',
    body: formData,
  });
  return handleJson<ExtractedDocumentResponse>(res);
}

export async function runAgreementAnalysis(payload: {
  agreementId?: string;
  title: string;
  text: string;
  fileName: string;
  sourceType: 'pdf' | 'txt' | 'pasted' | 'demo';
  isDemo?: boolean;
  pageCount?: number;
  rulebookVersionId: string;
  language?: string;
}): Promise<AgreementAnalysis> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<AgreementAnalysis>(res);
}

export async function deleteAnalysisById(id: string): Promise<void> {
  const res = await fetch(`/api/analyses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await handleJson<{ deleted: boolean }>(res);
}

export async function fetchRulebooks(): Promise<RulebookVersion[]> {
  const res = await fetch('/api/rulebooks');
  return handleJson<RulebookVersion[]>(res);
}

export async function createRulebookVersionApi(payload: {
  versionLabel: string;
  name: string;
  description: string;
  cloneFromVersionId?: string;
}): Promise<RulebookVersion> {
  const res = await fetch('/api/rulebooks/versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<RulebookVersion>(res);
}

export async function addRuleApi(
  versionId: string,
  rule: Omit<RulebookRule, 'id' | 'version' | 'updatedAt'>
): Promise<RulebookVersion> {
  const res = await fetch(`/api/rulebooks/versions/${encodeURIComponent(versionId)}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleJson<RulebookVersion>(res);
}

export async function updateRuleApi(
  versionId: string,
  ruleId: string,
  updates: Partial<Omit<RulebookRule, 'id' | 'version'>>
): Promise<RulebookVersion> {
  const res = await fetch(
    `/api/rulebooks/versions/${encodeURIComponent(versionId)}/rules/${encodeURIComponent(ruleId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }
  );
  return handleJson<RulebookVersion>(res);
}

export async function deleteRuleApi(versionId: string, ruleId: string): Promise<RulebookVersion> {
  const res = await fetch(
    `/api/rulebooks/versions/${encodeURIComponent(versionId)}/rules/${encodeURIComponent(ruleId)}`,
    {
      method: 'DELETE',
    }
  );
  return handleJson<RulebookVersion>(res);
}

export async function compareRulebookVersionsApi(payload: {
  baselineAnalysisId: string;
  targetRulebookVersionId: string;
  forceReanalyze?: boolean;
}): Promise<VersionComparisonResponse> {
  const res = await fetch('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<VersionComparisonResponse>(res);
}

export async function sendAgreementChatMessage(payload: {
  analysisId: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  language?: string;
}): Promise<{
  answer: string;
  supportingClauses: Array<{ clauseTitle: string; exactQuote: string }>;
  disclaimerNote: string;
}> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export async function translateAnalysisApi(
  analysisId: string,
  targetLanguage: string
): Promise<{
  analysis: AgreementAnalysis;
  translation: TranslatedAnalysisPayload;
}> {
  const res = await fetch(
    `/api/analyses/${encodeURIComponent(analysisId)}/translate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLanguage }),
    }
  );
  return handleJson(res);
}

export async function translateUiApi(
  targetLanguage: string,
  strings: Record<string, string>
): Promise<{ translations: Record<string, string> }> {
  const res = await fetch('/api/translate-ui', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage, strings }),
  });
  return handleJson(res);
}

export async function synthesizeSpeechApi(payload: {
  text: string;
  language?: string;
  voiceName?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export interface ScanDocumentResponse {
  fileName: string;
  sourceType: 'pdf' | 'pasted';
  pageCount: number;
  characterCount: number;
  wordCount: number;
  extractedText: string;
  detectedLanguage: string;
  suggestedTitle: string;
  scanQualityNote: string;
}

export async function scanAgreementFilesApi(files: File[]): Promise<ScanDocumentResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const res = await fetch('/api/agreements/scan', {
    method: 'POST',
    body: formData,
  });
  return handleJson<ScanDocumentResponse>(res);
}


