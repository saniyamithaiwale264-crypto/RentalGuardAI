import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AgreementAnalysis,
  ChatSupportingClause,
  ClauseDiffItem,
  ClauseFinding,
  KeyLeaseTerms,
  RiskLevel,
  RulebookVersion,
  TranslatedAnalysisPayload,
  VersionComparisonResponse,
} from '../src/types/rental.ts';
import { computeRiskScore } from '../src/utils/riskScore.ts';
import { normalizeSpeechPronunciation } from '../src/utils/speechText.ts';

function getGeminiClient(timeoutMs = 30000): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: timeoutMs,
    },
  });
}

function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string; code?: number } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Check if JSON is embedded inside string
    const match = raw.match(/\{"error":[\s\S]*\}/);
    if (match) {
      try {
        const inner = JSON.parse(match[0]) as { error?: { message?: string } };
        if (inner?.error?.message) {
          return inner.error.message;
        }
      } catch {
        // fallback to raw
      }
    }
  }
  return raw;
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Ensures the returned exactSourceText aligns verbatim with the uploaded agreement text
 * when whitespace or minor formatting differs.
 */
function alignSourceText(candidate: string, fullText: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) return '';
  if (fullText.includes(trimmed)) {
    return trimmed;
  }

  // Try matching normalized whitespace back to original slice
  const normCandidate = normalizeWhitespace(trimmed);
  const lines = fullText.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (normalizeWhitespace(line).includes(normCandidate)) {
      return line;
    }
  }

  // Try matching first 6 words to locate exact excerpt in original text
  const words = normCandidate.split(' ').filter((w) => w.length > 2);
  if (words.length >= 4) {
    const anchor = words.slice(0, 5).join(' ');
    const idx = fullText.toLowerCase().indexOf(anchor.toLowerCase());
    if (idx !== -1) {
      const endSearch = Math.min(fullText.length, idx + Math.max(trimmed.length + 80, 320));
      const slice = fullText.slice(idx, endSearch);
      const sentenceEnd = slice.search(/[.!?](?:\s|$)/);
      if (sentenceEnd > 20) {
        return slice.slice(0, sentenceEnd + 1).trim();
      }
      return slice.trim();
    }
  }

  return trimmed;
}

function normalizeRiskLevel(level: string): RiskLevel {
  const upper = String(level || '').toUpperCase().trim();
  if (upper === 'HIGH') return 'HIGH';
  if (upper === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RentalGuard Gemini attempt ${attempt} failed]:`, msg);
      // Do not retry auth, bad request, not found, or timeout errors
      if (
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('timeout') ||
        msg.includes('Timeout') ||
        msg.includes('AbortError') ||
        msg.includes('400') ||
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('429')
      ) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, 600 * attempt));
      }
    }
  }
  throw lastError;
}

interface RawGeminiAnalysisPayload {
  executiveSummary: string;
  keyTerms: KeyLeaseTerms;
  clauses: Array<{
    category: string;
    clauseTitle: string;
    riskLevel: string;
    plainEnglish: string;
    whyItMatters: string;
    exactSourceText: string;
    matchedRuleIds: string[];
    questionsToAsk: string[];
    recommendation: string;
  }>;
}

async function generateJsonWithFallback(params: {
  timeoutMs: number;
  prompt: string | Record<string, unknown>;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  preferFastModel?: boolean;
}): Promise<string> {
  const ai = getGeminiClient(params.timeoutMs);
  const primaryModel = params.preferFastModel ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
  const fallbackModel = params.preferFastModel ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';

  let response;
  try {
    response = await withRetry(
      () =>
        ai.models.generateContent({
          model: primaryModel,
          contents: params.prompt as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            systemInstruction: params.systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        }),
      1
    );
  } catch (primaryErr) {
    const primaryMsg = formatGeminiError(primaryErr);
    const lowerPrimary = primaryMsg.toLowerCase();
    const isTransientCapacity =
      lowerPrimary.includes('high demand') ||
      primaryMsg.includes('UNAVAILABLE') ||
      primaryMsg.includes('DEADLINE_EXCEEDED') ||
      primaryMsg.includes('503') ||
      lowerPrimary.includes('deadline') ||
      lowerPrimary.includes('timeout') ||
      lowerPrimary.includes('abort');

    if (!isTransientCapacity) {
      throw new Error(primaryMsg);
    }

    console.warn(
      `[RentalGuard] ${primaryModel} busy, falling back to ${fallbackModel}:`,
      primaryMsg
    );
    try {
      response = await withRetry(
        () =>
          ai.models.generateContent({
            model: fallbackModel,
            contents: params.prompt as Parameters<typeof ai.models.generateContent>[0]['contents'],
            config: {
              systemInstruction: params.systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: params.responseSchema,
            },
          }),
        1
      );
    } catch (fallbackErr) {
      throw new Error(formatGeminiError(fallbackErr));
    }
  }

  return (response.text ?? '{}').trim();
}

export async function analyzeAgreementWithGemini(params: {
  agreementId: string;
  title: string;
  fileName: string;
  sourceType: 'pdf' | 'txt' | 'pasted' | 'demo';
  isDemo: boolean;
  extractedText: string;
  pageCount?: number;
  rulebook: RulebookVersion;
  language?: string;
}): Promise<AgreementAnalysis> {
  const outputLanguage = (params.language || 'English').trim() || 'English';
  const activeRules = params.rulebook.rules.filter((r) => r.enabled);

  const rulebookContext = activeRules.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    jurisdiction: r.jurisdiction,
    sourceReference: r.sourceReference,
    severityHint: r.severityHint,
    verificationStatus: r.verificationStatus,
  }));

  const systemInstruction = `You are RentalGuard AI, an informational multilingual tenant lease-review assistant.
Your purpose is to help tenants understand rental agreements (written in ANY language) in clear, plain ${outputLanguage}, and flag potentially risky or one-sided clauses based strictly on the provided agreement text and the active Rulebook.

CRITICAL SAFETY & GROUNDING RULES:
1. INFORMATIONAL ONLY, NOT LEGAL ADVICE: Never give legal conclusions. Never state that a clause is "illegal", "void", or "unenforceable under law" unless quoting a verified legal reference explicitly present in the rulebook. Do NOT fabricate statutes, housing codes, case names, or section numbers.
2. VERBATIM EVIDENCE IN ORIGINAL LANGUAGE: For every clause finding, copy the exact verbatim substring from the uploaded rental agreement into "exactSourceText" WITHOUT translating or altering it.
3. OUTPUT LANGUAGE (${outputLanguage}): Write "executiveSummary", all values inside "keyTerms", "clauseTitle", "plainEnglish", "whyItMatters", "questionsToAsk", and "recommendation" strictly in ${outputLanguage}. Keep "riskLevel" strictly as one of "HIGH", "MEDIUM", or "LOW" in English uppercase.
4. RULEBOOK ALIGNMENT: Evaluate the lease carefully against the active Rulebook (${params.rulebook.versionLabel} — ${params.rulebook.name}). When a clause triggers one or more active rules, include their exact "id" values in "matchedRuleIds" and respect the rule's severityHint and description when assigning HIGH, MEDIUM, or LOW riskLevel.
5. COMPREHENSIVE COVERAGE: Inspect clauses covering Rent & Escalation, Security Deposit, Lock-in Period, Termination & Notice, Eviction & Entry, Maintenance & Repairs, Penalties & Late Fees, Renewal & Holdover, and Utilities & Other Terms.
6. PLAIN EXPLANATIONS & QUESTIONS: Explain every flagged clause clearly for a first-time renter in ${outputLanguage}, explain why it deserves attention, provide practical questions to ask the landlord, and give a balanced negotiation/clarification tip.`;

  const prompt = `Analyze the following rental agreement against the active Rulebook (${params.rulebook.versionLabel}: ${params.rulebook.name}). Write all tenant-facing explanations, key terms, summaries, questions, and recommendations in ${outputLanguage}, while keeping "exactSourceText" verbatim from the original agreement.

ACTIVE RULEBOOK RULES (JSON):
${JSON.stringify(rulebookContext, null, 2)}

RENTAL AGREEMENT TEXT:
"""
${params.extractedText.slice(0, 45000)}
"""

Return a structured JSON analysis covering all significant clauses present in the agreement.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: {
        type: Type.STRING,
        description:
          'A concise 2-4 sentence plain-English overview of the key risks and notable terms in this agreement, without legal advice.',
      },
      keyTerms: {
        type: Type.OBJECT,
        properties: {
          monthlyRent: { type: Type.STRING, description: 'Monthly rent or "Not specified"' },
          securityDeposit: { type: Type.STRING, description: 'Security deposit amount/terms or "Not specified"' },
          leaseDuration: { type: Type.STRING, description: 'Lease duration/dates or "Not specified"' },
          lockInPeriod: { type: Type.STRING, description: 'Lock-in period details or "None mentioned"' },
          noticePeriod: { type: Type.STRING, description: 'Termination notice period(s) or "Not specified"' },
          lateFeePolicy: { type: Type.STRING, description: 'Late fee policy or "Not specified"' },
        },
        required: [
          'monthlyRent',
          'securityDeposit',
          'leaseDuration',
          'lockInPeriod',
          'noticePeriod',
          'lateFeePolicy',
        ],
      },
      clauses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description:
                'One of: Rent & Escalation, Security Deposit, Lock-in Period, Termination & Notice, Eviction & Entry, Maintenance & Repairs, Penalties & Late Fees, Renewal & Holdover, Utilities & Other Terms',
            },
            clauseTitle: {
              type: Type.STRING,
              description: 'Concise, clear title summarizing the clause.',
            },
            riskLevel: {
              type: Type.STRING,
              description: 'Strictly one of: HIGH, MEDIUM, LOW',
            },
            plainEnglish: {
              type: Type.STRING,
              description: 'Simple English explanation of what this clause means for the tenant.',
            },
            whyItMatters: {
              type: Type.STRING,
              description:
                'Why this clause deserves attention before signing, grounded in the text and rulebook without fabricating laws.',
            },
            exactSourceText: {
              type: Type.STRING,
              description: 'Exact verbatim quote copied from the rental agreement text.',
            },
            matchedRuleIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exact IDs from the active Rulebook rules that apply to this clause.',
            },
            questionsToAsk: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 specific, practical questions the tenant should ask the landlord.',
            },
            recommendation: {
              type: Type.STRING,
              description: 'Practical informational suggestion or clarification to request before signing.',
            },
          },
          required: [
            'category',
            'clauseTitle',
            'riskLevel',
            'plainEnglish',
            'whyItMatters',
            'exactSourceText',
            'matchedRuleIds',
            'questionsToAsk',
            'recommendation',
          ],
        },
      },
    },
    required: ['executiveSummary', 'keyTerms', 'clauses'],
  };

  const rawText = await generateJsonWithFallback({
    timeoutMs: 30000,
    prompt,
    systemInstruction,
    responseSchema,
  });
  const parsed = JSON.parse(rawText) as RawGeminiAnalysisPayload;

  const ruleMap = new Map(params.rulebook.rules.map((r) => [r.id, r]));

  const clauses: ClauseFinding[] = (parsed.clauses || []).map((c, index) => {
    const validMatchedIds = (c.matchedRuleIds || []).filter((id) => ruleMap.has(id));
    const matchedRuleTitles = validMatchedIds.map((id) => ruleMap.get(id)!.title);

    return {
      id: `clause-${Date.now()}-${index}`,
      category: c.category || 'Utilities & Other Terms',
      clauseTitle: c.clauseTitle || `Clause ${index + 1}`,
      riskLevel: normalizeRiskLevel(c.riskLevel),
      plainEnglish: c.plainEnglish || '',
      whyItMatters: c.whyItMatters || '',
      exactSourceText: alignSourceText(c.exactSourceText || '', params.extractedText),
      matchedRuleIds: validMatchedIds,
      matchedRuleTitles: matchedRuleTitles.length > 0 ? matchedRuleTitles : ['General Lease Review'],
      questionsToAsk: Array.isArray(c.questionsToAsk) ? c.questionsToAsk.filter(Boolean) : [],
      recommendation: c.recommendation || '',
    };
  });

  // Sort clauses: HIGH -> MEDIUM -> LOW
  const rank: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  clauses.sort((a, b) => rank[a.riskLevel] - rank[b.riskLevel]);

  const high = clauses.filter((c) => c.riskLevel === 'HIGH').length;
  const medium = clauses.filter((c) => c.riskLevel === 'MEDIUM').length;
  const low = clauses.filter((c) => c.riskLevel === 'LOW').length;

  const wordCount = params.extractedText.trim().split(/\s+/).filter(Boolean).length;

  const riskScore = computeRiskScore({ high, medium, low });
  const recommendedActions = clauses
    .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
    .slice(0, 5)
    .map((c) => c.recommendation)
    .filter(Boolean);

  return {
    id: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agreementId: params.agreementId,
    title: params.title,
    fileName: params.fileName,
    sourceType: params.sourceType,
    isDemo: params.isDemo,
    isSampleResult: false,
    extractedText: params.extractedText,
    pageCount: params.pageCount,
    wordCount,
    rulebookVersionId: params.rulebook.id,
    rulebookVersionLabel: params.rulebook.versionLabel,
    rulebookName: params.rulebook.name,
    analyzedAt: new Date().toISOString(),
    language: outputLanguage,
    executiveSummary: parsed.executiveSummary || 'Analysis completed against the selected rulebook.',
    informationalDisclaimer: `Informational review only — not legal advice. Findings reflect the rules in ${params.rulebook.versionLabel} (${params.rulebook.name}) and should be verified against local housing guidance or a qualified legal professional.`,
    keyTerms: parsed.keyTerms || {
      monthlyRent: 'Not specified',
      securityDeposit: 'Not specified',
      leaseDuration: 'Not specified',
      lockInPeriod: 'None mentioned',
      noticePeriod: 'Not specified',
      lateFeePolicy: 'Not specified',
    },
    riskScore,
    riskCounts: {
      high,
      medium,
      low,
      total: clauses.length,
    },
    recommendedActions,
    clauses,
  };
}

function tokenOverlapScore(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.min(wordsA.size, wordsB.size);
}

const RISK_WEIGHT: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export function computeVersionComparison(
  baseline: AgreementAnalysis,
  updated: AgreementAnalysis
): VersionComparisonResponse {
  const matchedUpdatedIds = new Set<string>();
  const diffs: ClauseDiffItem[] = [];

  for (const baseClause of baseline.clauses) {
    let bestMatch: ClauseFinding | undefined;
    let bestScore = 0;

    for (const updClause of updated.clauses) {
      if (matchedUpdatedIds.has(updClause.id)) continue;

      const sourceOverlap = tokenOverlapScore(baseClause.exactSourceText, updClause.exactSourceText);
      const titleOverlap = tokenOverlapScore(baseClause.clauseTitle, updClause.clauseTitle);
      const sameCategory =
        baseClause.category.toLowerCase() === updClause.category.toLowerCase() ? 0.25 : 0;
      const score = sourceOverlap * 0.65 + titleOverlap * 0.25 + sameCategory;

      if (score > bestScore && (sourceOverlap >= 0.35 || (sameCategory > 0 && titleOverlap >= 0.35))) {
        bestScore = score;
        bestMatch = updClause;
      }
    }

    if (bestMatch) {
      matchedUpdatedIds.add(bestMatch.id);
      if (baseClause.riskLevel !== bestMatch.riskLevel) {
        const escalated = RISK_WEIGHT[bestMatch.riskLevel] > RISK_WEIGHT[baseClause.riskLevel];
        diffs.push({
          status: 'LEVEL_CHANGED',
          clauseTitle: bestMatch.clauseTitle,
          category: bestMatch.category,
          exactSourceText: bestMatch.exactSourceText || baseClause.exactSourceText,
          before: baseClause,
          after: bestMatch,
          riskChangeDirection: escalated ? 'ESCALATED' : 'REDUCED',
          changeSummary: `Risk level ${escalated ? 'escalated' : 'reduced'} from ${baseClause.riskLevel} (${baseline.rulebookVersionLabel}) to ${bestMatch.riskLevel} (${updated.rulebookVersionLabel}).`,
        });
      } else {
        diffs.push({
          status: 'UNCHANGED',
          clauseTitle: bestMatch.clauseTitle,
          category: bestMatch.category,
          exactSourceText: bestMatch.exactSourceText || baseClause.exactSourceText,
          before: baseClause,
          after: bestMatch,
          riskChangeDirection: 'SAME',
          changeSummary: `Remained ${bestMatch.riskLevel} under both ${baseline.rulebookVersionLabel} and ${updated.rulebookVersionLabel}.`,
        });
      }
    } else {
      diffs.push({
        status: 'RESOLVED_RISK',
        clauseTitle: baseClause.clauseTitle,
        category: baseClause.category,
        exactSourceText: baseClause.exactSourceText,
        before: baseClause,
        changeSummary: `Previously flagged as ${baseClause.riskLevel} in ${baseline.rulebookVersionLabel}; no longer flagged under ${updated.rulebookVersionLabel}.`,
      });
    }
  }

  for (const updClause of updated.clauses) {
    if (!matchedUpdatedIds.has(updClause.id)) {
      diffs.push({
        status: 'NEW_RISK',
        clauseTitle: updClause.clauseTitle,
        category: updClause.category,
        exactSourceText: updClause.exactSourceText,
        after: updClause,
        changeSummary: `Newly flagged as ${updClause.riskLevel} under ${updated.rulebookVersionLabel} rules (${updClause.matchedRuleTitles.join(', ')}).`,
      });
    }
  }

  const order: Record<ClauseDiffItem['status'], number> = {
    NEW_RISK: 0,
    LEVEL_CHANGED: 1,
    RESOLVED_RISK: 2,
    UNCHANGED: 3,
  };
  diffs.sort((a, b) => order[a.status] - order[b.status]);

  return {
    agreementId: baseline.agreementId,
    agreementTitle: baseline.title,
    baselineAnalysis: baseline,
    updatedAnalysis: updated,
    summary: {
      newlyFlaggedCount: diffs.filter((d) => d.status === 'NEW_RISK').length,
      resolvedCount: diffs.filter((d) => d.status === 'RESOLVED_RISK').length,
      changedLevelCount: diffs.filter((d) => d.status === 'LEVEL_CHANGED').length,
      unchangedCount: diffs.filter((d) => d.status === 'UNCHANGED').length,
      highDelta: updated.riskCounts.high - baseline.riskCounts.high,
      mediumDelta: updated.riskCounts.medium - baseline.riskCounts.medium,
      lowDelta: updated.riskCounts.low - baseline.riskCounts.low,
    },
    diffs,
  };
}

interface RawChatPayload {
  answer: string;
  supportingClauses: Array<{ clauseTitle: string; exactQuote: string }>;
  disclaimerNote: string;
}

export async function chatAboutAgreementWithGemini(params: {
  analysis: AgreementAnalysis;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  language?: string;
}): Promise<{
  answer: string;
  supportingClauses: ChatSupportingClause[];
  disclaimerNote: string;
}> {
  const outputLanguage = (params.language || 'English').trim() || 'English';

  const recentHistory = (params.history || [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Tenant' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const systemInstruction = `You are RentalGuard AI Assistant, helping a tenant understand their rental agreement in plain, accessible language.
CRITICAL RULES:
1. GROUNDED ONLY IN AGREEMENT TEXT: Answer strictly using the provided rental agreement text and extracted clause findings. If the agreement does not specify or cover something, clearly state that the uploaded document does not mention it.
2. NO FABRICATED LAWS OR LEGAL ADVICE: Never invent statutes, housing codes, case citations, or legal conclusions. Never say a clause is "illegal" or give formal legal advice.
3. EXACT SUPPORTING QUOTES: For every supporting reference you include in "supportingClauses", copy the exact verbatim quote from the agreement text into "exactQuote" in its original language.
4. MULTILINGUAL RESPONSE: Write "answer", "clauseTitle", and "disclaimerNote" in ${outputLanguage} (unless the tenant's latest question is clearly written in another language, in which case respond in that language). Keep monetary figures, dates, and fees accurate.`;

  const prompt = `AGREEMENT TITLE: ${params.analysis.title}
PREFERRED RESPONSE LANGUAGE: ${outputLanguage}

RENTAL AGREEMENT TEXT:
"""
${params.analysis.extractedText.slice(0, 40000)}
"""

${recentHistory ? `RECENT CONVERSATION:\n${recentHistory}\n\n` : ''}TENANT QUESTION: ${params.message}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      answer: {
        type: Type.STRING,
        description:
          `Clear answer in ${outputLanguage} grounded strictly in the uploaded agreement text.`,
      },
      supportingClauses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            clauseTitle: {
              type: Type.STRING,
              description: `Short label in ${outputLanguage} for the referenced section or clause.`,
            },
            exactQuote: {
              type: Type.STRING,
              description: 'Exact verbatim quote from the agreement supporting the answer.',
            },
          },
          required: ['clauseTitle', 'exactQuote'],
        },
      },
      disclaimerNote: {
        type: Type.STRING,
        description:
          `Brief informational reminder in ${outputLanguage} (not legal advice) or note if the lease omits details.`,
      },
    },
    required: ['answer', 'supportingClauses', 'disclaimerNote'],
  };

  const rawText = await generateJsonWithFallback({
    timeoutMs: 15000,
    prompt,
    systemInstruction,
    responseSchema,
  });
  const parsed = JSON.parse(rawText) as RawChatPayload;

  const supportingClauses: ChatSupportingClause[] = (parsed.supportingClauses || [])
    .map((sc) => ({
      clauseTitle: sc.clauseTitle || 'Referenced Clause',
      exactQuote: alignSourceText(sc.exactQuote || '', params.analysis.extractedText),
    }))
    .filter((sc) => sc.exactQuote.length > 0);

  return {
    answer:
      parsed.answer ||
      'I could not generate an answer from the provided agreement text.',
    supportingClauses,
    disclaimerNote:
      parsed.disclaimerNote ||
      'Informational guidance based strictly on your uploaded document — not legal advice.',
  };
}

export async function translateAnalysisWithGemini(params: {
  analysis: AgreementAnalysis;
  targetLanguage: string;
}): Promise<TranslatedAnalysisPayload> {
  const targetLanguage = params.targetLanguage.trim() || 'English';

  const sourcePayload = {
    executiveSummary: params.analysis.executiveSummary,
    informationalDisclaimer: params.analysis.informationalDisclaimer,
    keyTerms: params.analysis.keyTerms,
    recommendedActions: params.analysis.recommendedActions || [],
    clauses: params.analysis.clauses.map((c) => ({
      id: c.id,
      category: c.category,
      clauseTitle: c.clauseTitle,
      plainEnglish: c.plainEnglish,
      whyItMatters: c.whyItMatters,
      questionsToAsk: c.questionsToAsk,
      recommendation: c.recommendation,
    })),
  };

  const systemInstruction = `You are a professional legal-tech translator for RentalGuard AI.
Translate the provided rental agreement analysis JSON into clear, natural ${targetLanguage}.
CRITICAL RULES:
1. Keep every clause "id" value 100% identical to the input.
2. Preserve all numbers, currency amounts, percentages, and durations accurately.
3. Keep the non-legal-advice disclaimer accurate and cautious. Do NOT add fabricated laws or legal claims.
4. Translate all text fields (executiveSummary, informationalDisclaimer, keyTerms values, recommendedActions, category, clauseTitle, plainEnglish, whyItMatters, questionsToAsk, recommendation) into ${targetLanguage}.`;

  const prompt = `Translate the following JSON analysis report into ${targetLanguage}:

${JSON.stringify(sourcePayload, null, 2)}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: { type: Type.STRING },
      informationalDisclaimer: { type: Type.STRING },
      keyTerms: {
        type: Type.OBJECT,
        properties: {
          monthlyRent: { type: Type.STRING },
          securityDeposit: { type: Type.STRING },
          leaseDuration: { type: Type.STRING },
          lockInPeriod: { type: Type.STRING },
          noticePeriod: { type: Type.STRING },
          lateFeePolicy: { type: Type.STRING },
        },
        required: [
          'monthlyRent',
          'securityDeposit',
          'leaseDuration',
          'lockInPeriod',
          'noticePeriod',
          'lateFeePolicy',
        ],
      },
      recommendedActions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      clauses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            category: { type: Type.STRING },
            clauseTitle: { type: Type.STRING },
            plainEnglish: { type: Type.STRING },
            whyItMatters: { type: Type.STRING },
            questionsToAsk: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendation: { type: Type.STRING },
          },
          required: [
            'id',
            'category',
            'clauseTitle',
            'plainEnglish',
            'whyItMatters',
            'questionsToAsk',
            'recommendation',
          ],
        },
      },
    },
    required: [
      'executiveSummary',
      'informationalDisclaimer',
      'keyTerms',
      'recommendedActions',
      'clauses',
    ],
  };

  const rawText = await generateJsonWithFallback({
    timeoutMs: 25000,
    prompt,
    systemInstruction,
    responseSchema,
    preferFastModel: true,
  });

  const parsed = JSON.parse(rawText) as Omit<
    TranslatedAnalysisPayload,
    'language' | 'translatedAt'
  >;

  return {
    language: targetLanguage,
    executiveSummary: parsed.executiveSummary || params.analysis.executiveSummary,
    informationalDisclaimer:
      parsed.informationalDisclaimer || params.analysis.informationalDisclaimer,
    keyTerms: parsed.keyTerms || params.analysis.keyTerms,
    recommendedActions: Array.isArray(parsed.recommendedActions)
      ? parsed.recommendedActions
      : params.analysis.recommendedActions || [],
    clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
    translatedAt: new Date().toISOString(),
  };
}

export async function translateUiStringsWithGemini(params: {
  strings: Record<string, string>;
  targetLanguage: string;
}): Promise<Record<string, string>> {
  const entries = Object.entries(params.strings);
  const systemInstruction = `You translate short UI labels for RentalGuard AI (a tenant lease review app) into ${params.targetLanguage}.
Return an array of { key, value } keeping every "key" identical to the input and translating "value" naturally and concisely for UI buttons, navigation tabs, and headings.`;

  const prompt = `Translate these UI labels into ${params.targetLanguage}:
${JSON.stringify(entries.map(([key, value]) => ({ key, value })))}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING },
            value: { type: Type.STRING },
          },
          required: ['key', 'value'],
        },
      },
    },
    required: ['items'],
  };

  const rawText = await generateJsonWithFallback({
    timeoutMs: 15000,
    prompt,
    systemInstruction,
    responseSchema,
    preferFastModel: true,
  });

  const parsed = JSON.parse(rawText) as { items?: Array<{ key: string; value: string }> };
  const result: Record<string, string> = { ...params.strings };
  for (const item of parsed.items || []) {
    if (item.key && item.value) {
      result[item.key] = item.value;
    }
  }
  return result;
}

function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastPunct = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('। '),
    slice.lastIndexOf('。')
  );
  if (lastPunct > maxChars * 0.5) {
    return slice.slice(0, lastPunct + 1).trim();
  }
  return slice.trim();
}

const ALLOWED_VOICES = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);

export async function synthesizeSpeechWithGemini(params: {
  text: string;
  language?: string;
  voiceName?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const normalized = normalizeSpeechPronunciation(params.text || '');
  const spokenText = truncateAtSentenceBoundary(normalized, 2200);
  if (!spokenText) {
    throw new Error('Text to read aloud cannot be empty.');
  }

  const language = (params.language || 'English').trim() || 'English';
  const voiceName =
    params.voiceName && ALLOWED_VOICES.has(params.voiceName) ? params.voiceName : 'Kore';

  const attempts: Array<{
    apiVersion?: 'v1beta' | 'v1alpha';
    includeSpeechMetadata: boolean;
    includeSpeechConfig: boolean;
  }> = [
    { apiVersion: 'v1alpha', includeSpeechMetadata: true, includeSpeechConfig: true },
    { apiVersion: 'v1beta', includeSpeechMetadata: false, includeSpeechConfig: true },
    { apiVersion: undefined, includeSpeechMetadata: false, includeSpeechConfig: false },
  ];

  let lastErr: unknown;
  for (const cfg of attempts) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        throw new Error(
          'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in the Settings > Secrets panel.'
        );
      }
      const ai = new GoogleGenAI({
        apiKey,
        ...(cfg.apiVersion ? { apiVersion: cfg.apiVersion } : {}),
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          timeout: 28000,
        },
      });

      const part = cfg.includeSpeechMetadata
        ? {
            text: spokenText,
            speechMetadata: {
              style: `Crystal-clear pronunciation, crisp articulation, unhurried steady pace, and natural pauses between sentences and numbers while speaking in ${language}`,
            },
          }
        : {
            text: `Read the following text aloud with crystal-clear pronunciation, crisp diction, and natural pauses in ${language}:\n\n${spokenText}`,
          };

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [{ role: 'user', parts: [part] }],
        config: {
          responseModalities: ['AUDIO'],
          ...(cfg.includeSpeechConfig
            ? {
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              }
            : {}),
        },
      });

      const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inline?.data) {
        return {
          audioBase64: inline.data,
          mimeType: inline.mimeType || 'audio/wav',
        };
      }
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RentalGuard TTS attempt ${cfg.apiVersion || 'default'} failed]:`, msg);
    }
  }

  throw new Error(
    lastErr instanceof Error ? formatGeminiError(lastErr) : 'Gemini TTS did not return audio data.'
  );
}

export async function scanAgreementPagesWithGemini(
  files: Array<{ buffer: Buffer; mimeType: string; fileName: string }>
): Promise<{
  extractedText: string;
  detectedLanguage: string;
  suggestedTitle: string;
  scanQualityNote: string;
}> {
  if (!files || files.length === 0) {
    throw new Error('Please provide at least one image or PDF page to scan.');
  }

  const parts: Array<Record<string, unknown>> = files.map((f) => ({
    inlineData: {
      mimeType: f.mimeType,
      data: f.buffer.toString('base64'),
    },
  }));

  parts.push({
    text: `Perform verbatim OCR extraction on the attached ${files.length} rental agreement page(s).
Preserve exact wording, numbers, currency amounts, dates, clause headings, and reading order in the document's original language.
If multiple pages are provided, join them cleanly in order. Do not summarize or invent missing clauses.`,
  });

  const systemInstruction = `You are RentalGuard AI's high-precision multilingual document OCR scanner.
Extract all visible text verbatim from photos or scanned PDFs of rental/lease agreements in ANY language (English, Hindi, Arabic, Spanish, Tamil, Chinese, etc.).
Never invent text that is not visible in the image/PDF. If any portion is blurry or cut off, mention it briefly in scanQualityNote.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      extractedText: {
        type: Type.STRING,
        description: 'Complete verbatim text extracted from all uploaded pages in reading order.',
      },
      detectedLanguage: {
        type: Type.STRING,
        description: 'Primary language of the scanned document (e.g., English, Hindi, Spanish).',
      },
      suggestedTitle: {
        type: Type.STRING,
        description: 'Concise descriptive title for this rental agreement based on its header or property name.',
      },
      scanQualityNote: {
        type: Type.STRING,
        description: 'Brief note on scan legibility (e.g., "Clear scan" or noting any blurry/cropped edge).',
      },
    },
    required: ['extractedText', 'detectedLanguage', 'suggestedTitle', 'scanQualityNote'],
  };

  const rawText = await generateJsonWithFallback({
    timeoutMs: 35000,
    prompt: { parts },
    systemInstruction,
    responseSchema,
  });

  const parsed = JSON.parse(rawText) as {
    extractedText?: string;
    detectedLanguage?: string;
    suggestedTitle?: string;
    scanQualityNote?: string;
  };

  const extractedText = (parsed.extractedText || '').trim();
  if (!extractedText) {
    throw new Error(
      'No readable text could be detected in the uploaded scan. Please ensure good lighting and clear focus.'
    );
  }

  return {
    extractedText,
    detectedLanguage: (parsed.detectedLanguage || 'English').trim(),
    suggestedTitle: (parsed.suggestedTitle || 'Scanned Rental Agreement').trim(),
    scanQualityNote: (parsed.scanQualityNote || 'Clear scan').trim(),
  };
}


