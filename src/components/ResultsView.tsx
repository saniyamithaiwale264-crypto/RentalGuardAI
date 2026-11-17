import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  Download,
  FileText,
  GitCompare,
  Globe,
  HelpCircle,
  Info,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquareText,
  Quote,
  Search,
  ShieldAlert,
  ShieldCheck,
  Square,
  Volume2,
} from 'lucide-react';
import type { AgreementAnalysis, RiskLevel } from '../types/rental.ts';
import { computeRiskScore } from '../utils/riskScore.ts';
import { generateAgreementPdfReport } from '../utils/pdfReport.ts';
import { translateAnalysisApi } from '../services/api.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useReadAloud } from '../context/ReadAloudContext.tsx';
import {
  CUSTOM_LANGUAGE_CODE,
  SUPPORTED_LANGUAGES,
  resolveLanguageLabel,
} from '../utils/languages.ts';
import { RiskBadge } from './RiskBadge.tsx';
import { RiskScoreGauge } from './RiskScoreGauge.tsx';

interface ResultsViewProps {
  analysis: AgreementAnalysis;
  onAnalysisUpdated?: (updated: AgreementAnalysis) => void;
  onBackToDashboard?: () => void;
  onCompareVersion: (analysis: AgreementAnalysis) => void;
  onOpenChat: (analysis: AgreementAnalysis, prefilledQuestion?: string) => void;
}

export function ResultsView({
  analysis,
  onAnalysisUpdated,
  onBackToDashboard,
  onCompareVersion,
  onOpenChat,
}: ResultsViewProps) {
  const { languageCode, customLanguage, languageName, t } = useLanguage();
  const { status: audioStatus, activeItemId, toggleSpeak } = useReadAloud();
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const [reportLangCode, setReportLangCode] = useState<string>(languageCode);
  const [reportCustomLang, setReportCustomLang] = useState<string>(customLanguage);
  const [activeTranslationLang, setActiveTranslationLang] = useState<string | null>(() => {
    const baseLang = analysis.language || 'English';
    if (languageName !== baseLang && analysis.translations?.[languageName]) {
      return languageName;
    }
    return null;
  });
  const [translatingReport, setTranslatingReport] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const prevAnalysisIdRef = useRef(analysis.id);

  useEffect(() => {
    if (prevAnalysisIdRef.current === analysis.id) return;
    prevAnalysisIdRef.current = analysis.id;
    const baseLang = analysis.language || 'English';
    setTranslateError(null);
    setReportLangCode(languageCode);
    setReportCustomLang(customLanguage);
    if (languageName !== baseLang && analysis.translations?.[languageName]) {
      setActiveTranslationLang(languageName);
    } else {
      setActiveTranslationLang(null);
    }
  }, [analysis.id, analysis.language, analysis.translations, languageCode, customLanguage, languageName]);

  const activeTranslation =
    activeTranslationLang && analysis.translations?.[activeTranslationLang]
      ? analysis.translations[activeTranslationLang]
      : null;

  const effectiveAnalysis: AgreementAnalysis = useMemo(() => {
    if (!activeTranslation) return analysis;
    const translatedMap = new Map(activeTranslation.clauses.map((c) => [c.id, c]));
    return {
      ...analysis,
      language: activeTranslation.language,
      executiveSummary: activeTranslation.executiveSummary,
      informationalDisclaimer: activeTranslation.informationalDisclaimer,
      keyTerms: activeTranslation.keyTerms,
      recommendedActions:
        activeTranslation.recommendedActions.length > 0
          ? activeTranslation.recommendedActions
          : analysis.recommendedActions,
      clauses: analysis.clauses.map((orig) => {
        const tr = translatedMap.get(orig.id);
        if (!tr) return orig;
        return {
          ...orig,
          category: tr.category || orig.category,
          clauseTitle: tr.clauseTitle || orig.clauseTitle,
          plainEnglish: tr.plainEnglish || orig.plainEnglish,
          whyItMatters: tr.whyItMatters || orig.whyItMatters,
          questionsToAsk:
            tr.questionsToAsk && tr.questionsToAsk.length > 0
              ? tr.questionsToAsk
              : orig.questionsToAsk,
          recommendation: tr.recommendation || orig.recommendation,
          // Always preserve exact verbatim source quote
          exactSourceText: orig.exactSourceText,
        };
      }),
    };
  }, [analysis, activeTranslation]);

  async function handleTranslateReport(targetLang: string) {
    const cleanTarget = targetLang.trim();
    if (!cleanTarget) return;
    const baseLang = analysis.language || 'English';
    if (cleanTarget.toLowerCase() === baseLang.toLowerCase()) {
      setActiveTranslationLang(null);
      setTranslateError(null);
      return;
    }

    if (analysis.translations?.[cleanTarget]) {
      setActiveTranslationLang(cleanTarget);
      setTranslateError(null);
      return;
    }

    setTranslatingReport(true);
    setTranslateError(null);
    try {
      const res = await translateAnalysisApi(analysis.id, cleanTarget);
      onAnalysisUpdated?.(res.analysis);
      setActiveTranslationLang(cleanTarget);
    } catch (err) {
      setTranslateError(
        err instanceof Error ? err.message : 'Unable to translate report.'
      );
    } finally {
      setTranslatingReport(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set(effectiveAnalysis.clauses.map((c) => c.category));
    return ['ALL', ...Array.from(set)];
  }, [effectiveAnalysis.clauses]);

  const filteredClauses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveAnalysis.clauses.filter((c) => {
      if (riskFilter !== 'ALL' && c.riskLevel !== riskFilter) return false;
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.clauseTitle.toLowerCase().includes(q) ||
        c.plainEnglish.toLowerCase().includes(q) ||
        c.exactSourceText.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [effectiveAnalysis.clauses, riskFilter, categoryFilter, search]);

  const recommendedActions = useMemo(() => {
    if (effectiveAnalysis.recommendedActions && effectiveAnalysis.recommendedActions.length > 0) {
      return effectiveAnalysis.recommendedActions;
    }
    return effectiveAnalysis.clauses
      .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
      .slice(0, 4)
      .map((c) => c.recommendation)
      .filter(Boolean);
  }, [effectiveAnalysis]);

  const reportSpeechLanguage =
    effectiveAnalysis.language || analysis.language || languageName;

  function buildFullReportSpeech(): string {
    const parts: string[] = [
      `${effectiveAnalysis.title}.`,
      `${t('executiveSummary')}: ${effectiveAnalysis.executiveSummary}`,
      `Risk summary: ${analysis.riskCounts.high} high risk, ${analysis.riskCounts.medium} medium risk, and ${analysis.riskCounts.low} low risk clauses.`,
      `Key terms: Monthly rent ${effectiveAnalysis.keyTerms.monthlyRent}. Security deposit ${effectiveAnalysis.keyTerms.securityDeposit}. Lease duration ${effectiveAnalysis.keyTerms.leaseDuration}. Lock-in period ${effectiveAnalysis.keyTerms.lockInPeriod}. Notice period ${effectiveAnalysis.keyTerms.noticePeriod}. Late fee policy ${effectiveAnalysis.keyTerms.lateFeePolicy}.`,
    ];
    if (recommendedActions.length > 0) {
      parts.push(`${t('recommendedBeforeSigning')}: ${recommendedActions.join('. ')}`);
    }
    const topClauses = effectiveAnalysis.clauses.slice(0, 4);
    topClauses.forEach((c, idx) => {
      parts.push(
        `Clause ${idx + 1}: ${c.clauseTitle} (${c.riskLevel}). ${c.plainEnglish}`
      );
    });
    return parts.join(' ');
  }

  function buildClauseSpeech(c: AgreementAnalysis['clauses'][number]): string {
    const parts: string[] = [
      `${c.clauseTitle}. ${c.riskLevel} risk.`,
      c.plainEnglish,
      c.whyItMatters,
    ];
    if (c.questionsToAsk.length > 0) {
      parts.push(`${t('questionsForLandlord')}: ${c.questionsToAsk.join(' ')}`);
    }
    if (c.recommendation) {
      parts.push(`${t('practicalRecommendation')}: ${c.recommendation}`);
    }
    return parts.join(' ');
  }

  const totalClauses = Math.max(analysis.riskCounts.total, 1);
  const highPct = Math.round((analysis.riskCounts.high / totalClauses) * 100);
  const medPct = Math.round((analysis.riskCounts.medium / totalClauses) * 100);
  const lowPct = Math.max(0, 100 - highPct - medPct);

  const anyExpanded = filteredClauses.some((c) => !collapsedIds[c.id]);

  function toggleClause(id: string) {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllVisible() {
    if (anyExpanded) {
      const next: Record<string, boolean> = { ...collapsedIds };
      filteredClauses.forEach((c) => {
        next[c.id] = true;
      });
      setCollapsedIds(next);
    } else {
      const next: Record<string, boolean> = { ...collapsedIds };
      filteredClauses.forEach((c) => {
        next[c.id] = false;
      });
      setCollapsedIds(next);
    }
  }

  async function handleCopyQuote(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked in some contexts
    }
  }

  async function handleCopyAllQuestions() {
    const lines: string[] = [
      `Questions for Landlord — ${effectiveAnalysis.title}`,
      '',
    ];
    effectiveAnalysis.clauses.forEach((c, idx) => {
      if (c.questionsToAsk.length > 0) {
        lines.push(`${idx + 1}. ${c.clauseTitle} (${c.riskLevel} Risk)`);
        c.questionsToAsk.forEach((q) => lines.push(`   - ${q}`));
        lines.push('');
      }
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div className="space-y-6">
      {onBackToDashboard && (
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to {t('navDashboard')}</span>
          </button>
        </div>
      )}

      {/* Informational Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-violet-500/25 bg-violet-950/15 px-4 py-3 text-xs text-zinc-300">
        <Info className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <span className="font-semibold text-white">Informational Assistance Only (Not Legal Advice):</span>{' '}
          {effectiveAnalysis.informationalDisclaimer}
        </p>
      </div>

      {/* Report Translation Bar */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0C0C14] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <Globe className="h-4 w-4 text-violet-400 shrink-0" aria-hidden="true" />
          <span className="font-medium text-white">{t('translateReportLabel')}:</span>
          <span className="text-zinc-400">
            {activeTranslation
              ? `${activeTranslation.language} (quotes preserved verbatim)`
              : `${analysis.language || 'English'} (${t('showOriginal')})`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t('translateReportLabel')}
            value={reportLangCode}
            onChange={(e) => {
              const code = e.target.value;
              setReportLangCode(code);
              if (code !== CUSTOM_LANGUAGE_CODE) {
                void handleTranslateReport(resolveLanguageLabel(code));
              }
            }}
            disabled={translatingReport}
            className="rounded-lg border border-white/[0.1] bg-[#07070C] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none disabled:opacity-50"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName === lang.name
                  ? lang.name
                  : `${lang.nativeName} — ${lang.name}`}
              </option>
            ))}
            <option value={CUSTOM_LANGUAGE_CODE}>+ Any Other Language (Custom)...</option>
          </select>

          {reportLangCode === CUSTOM_LANGUAGE_CODE && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleTranslateReport(reportCustomLang);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={reportCustomLang}
                onChange={(e) => setReportCustomLang(e.target.value)}
                placeholder={t('customLanguagePlaceholder')}
                className="w-44 rounded-lg border border-white/[0.12] bg-[#07070C] px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={translatingReport || !reportCustomLang.trim()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 whitespace-nowrap"
              >
                {t('applyLanguage')}
              </button>
            </form>
          )}

          {translatingReport && (
            <span className="inline-flex items-center gap-1.5 text-xs text-violet-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>{t('translatingReport')}</span>
            </span>
          )}

          {activeTranslation && !translatingReport && (
            <button
              type="button"
              onClick={() => setActiveTranslationLang(null)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] whitespace-nowrap"
            >
              {t('showOriginal')} ({analysis.language || 'English'})
            </button>
          )}
        </div>
      </div>

      {translateError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200"
        >
          {translateError}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span>{analysis.isSampleResult ? 'Sample Demo Analysis' : 'AI Clause Analysis'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{analysis.rulebookVersionLabel} ({analysis.rulebookName})</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.fileName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{analysis.wordCount} words</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
            {analysis.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowFullDocument((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
            <span>{showFullDocument ? 'Hide Source Text' : 'View Source Text'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAllQuestions}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
          >
            {copiedQuestions ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
            )}
            <span>{copiedQuestions ? 'Copied Questions' : 'Copy Landlord Questions'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              void toggleSpeak({
                id: `report-full-${analysis.id}`,
                title: `${t('readFullReport')} — ${effectiveAnalysis.title}`,
                text: buildFullReportSpeech(),
                languageName: reportSpeechLanguage,
              })
            }
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeItemId === `report-full-${analysis.id}` && audioStatus !== 'idle'
                ? 'border-violet-500 bg-violet-600 text-white'
                : 'border-white/[0.1] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08]'
            }`}
          >
            {activeItemId === `report-full-${analysis.id}` && audioStatus !== 'idle' ? (
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            )}
            <span>
              {activeItemId === `report-full-${analysis.id}` && audioStatus !== 'idle'
                ? t('stopReading')
                : t('readFullReport')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => generateAgreementPdfReport(effectiveAnalysis)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            <span>{t('downloadPdfReport')}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenChat(analysis)}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-600/15 px-3.5 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-600/25 whitespace-nowrap"
          >
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('askAiChat')}</span>
          </button>

          <button
            type="button"
            onClick={() => onCompareVersion(analysis)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500 whitespace-nowrap"
          >
            <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('compareRulebookVersion')}</span>
          </button>
        </div>
      </div>

      {/* Risk Summary Cards + Score Gauge + Distribution */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">Risk Score &amp; Distribution</h2>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {analysis.riskCounts.total} Clauses Flagged
              </span>
            </div>

            <div className="mt-4 pb-4 border-b border-white/[0.06] space-y-2.5">
              <RiskScoreGauge
                size="sm"
                score={
                  typeof analysis.riskScore === 'number'
                    ? analysis.riskScore
                    : computeRiskScore(analysis.riskCounts)
                }
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
                <span>0–33 Low Attention</span>
                <span>34–66 Moderate</span>
                <span>67–100 High Attention</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-3">
                <div className="text-xs font-medium text-red-400">High</div>
                <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
                  {analysis.riskCounts.high}
                </div>
              </div>
              <div className="rounded-lg border border-orange-500/25 bg-orange-500/[0.06] p-3">
                <div className="text-xs font-medium text-orange-400">Medium</div>
                <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
                  {analysis.riskCounts.medium}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                <div className="text-xs font-medium text-emerald-400">Low</div>
                <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
                  {analysis.riskCounts.low}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              {analysis.riskCounts.high > 0 && (
                <div
                  style={{ width: `${highPct}%` }}
                  className="bg-red-500 transition-all"
                  title={`High Risk: ${analysis.riskCounts.high}`}
                />
              )}
              {analysis.riskCounts.medium > 0 && (
                <div
                  style={{ width: `${medPct}%` }}
                  className="bg-orange-500 transition-all"
                  title={`Medium Risk: ${analysis.riskCounts.medium}`}
                />
              )}
              {analysis.riskCounts.low > 0 && (
                <div
                  style={{ width: `${lowPct}%` }}
                  className="bg-emerald-500 transition-all"
                  title={`Low Risk: ${analysis.riskCounts.low}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Executive Summary & Key Lease Terms */}
        <div className="lg:col-span-7 rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-white">
                {t('executiveSummary')}
              </h2>
              <button
                type="button"
                onClick={() =>
                  void toggleSpeak({
                    id: `summary-${analysis.id}`,
                    title: `${t('executiveSummary')} — ${effectiveAnalysis.title}`,
                    text: effectiveAnalysis.executiveSummary,
                    languageName: reportSpeechLanguage,
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  activeItemId === `summary-${analysis.id}` && audioStatus !== 'idle'
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
                }`}
              >
                {activeItemId === `summary-${analysis.id}` && audioStatus !== 'idle' ? (
                  <Square className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3 w-3 text-violet-400" aria-hidden="true" />
                )}
                <span>
                  {activeItemId === `summary-${analysis.id}` && audioStatus !== 'idle'
                    ? t('stopReading')
                    : t('readAloud')}
                </span>
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
              {effectiveAnalysis.executiveSummary}
            </p>
          </div>

          <div className="border-t border-white/[0.07] pt-4 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2 md:grid-cols-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <DollarSign className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>Monthly Rent</span>
              </div>
              <div className="font-medium text-zinc-100 tabular-nums">
                {effectiveAnalysis.keyTerms.monthlyRent}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>Security Deposit</span>
              </div>
              <div className="font-medium text-zinc-100 tabular-nums">
                {effectiveAnalysis.keyTerms.securityDeposit}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Calendar className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>Lease Duration</span>
              </div>
              <div className="font-medium text-zinc-100 tabular-nums">
                {effectiveAnalysis.keyTerms.leaseDuration}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Lock className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>Lock-in Period</span>
              </div>
              <div className="font-medium text-zinc-100 tabular-nums">
                {effectiveAnalysis.keyTerms.lockInPeriod}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>Notice Period</span>
              </div>
              <div className="font-medium text-zinc-100 tabular-nums">
                {effectiveAnalysis.keyTerms.noticePeriod}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <AlertCircle className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>Late Fee Policy</span>
              </div>
              <div className="font-medium text-zinc-100 tabular-nums">
                {effectiveAnalysis.keyTerms.lateFeePolicy}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended Actions Before Signing */}
      {recommendedActions.length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold text-white">
                {t('recommendedBeforeSigning')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                void toggleSpeak({
                  id: `actions-${analysis.id}`,
                  title: t('recommendedBeforeSigning'),
                  text: recommendedActions.join('. '),
                  languageName: reportSpeechLanguage,
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeItemId === `actions-${analysis.id}` && audioStatus !== 'idle'
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
              }`}
            >
              {activeItemId === `actions-${analysis.id}` && audioStatus !== 'idle' ? (
                <Square className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3 w-3 text-violet-400" aria-hidden="true" />
              )}
              <span>
                {activeItemId === `actions-${analysis.id}` && audioStatus !== 'idle'
                  ? t('stopReading')
                  : t('readAloud')}
              </span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {recommendedActions.map((act, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-[#07070C] px-3.5 py-2.5 text-xs text-zinc-300 leading-relaxed"
              >
                <span className="font-mono text-[11px] font-semibold text-violet-400 shrink-0 mt-0.5">
                  0{idx + 1}.
                </span>
                <span>{act}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Collapsible Full Source Document */}
      {showFullDocument && (
        <section className="rounded-xl border border-white/[0.08] bg-[#09090F] p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-sm font-semibold text-white">
              Original Extracted Document Text
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void toggleSpeak({
                    id: `source-${analysis.id}`,
                    title: analysis.fileName || analysis.title,
                    text: analysis.extractedText,
                    languageName: analysis.language || 'English',
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  activeItemId === `source-${analysis.id}` && audioStatus !== 'idle'
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
                }`}
              >
                {activeItemId === `source-${analysis.id}` && audioStatus !== 'idle' ? (
                  <Square className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3 w-3 text-violet-400" aria-hidden="true" />
                )}
                <span>
                  {activeItemId === `source-${analysis.id}` && audioStatus !== 'idle'
                    ? t('stopReading')
                    : t('readAloud')}
                </span>
              </button>
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {analysis.wordCount} words
              </span>
            </div>
          </div>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-[#06060A] p-4 font-mono text-xs leading-relaxed text-zinc-300">
            {analysis.extractedText}
          </pre>
        </section>
      )}

      {/* Filter Bar */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0C0C14] p-1">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
            const active = riskFilter === level;
            const label =
              level === 'ALL'
                ? `All (${analysis.riskCounts.total})`
                : level === 'HIGH'
                ? `High (${analysis.riskCounts.high})`
                : level === 'MEDIUM'
                ? `Medium (${analysis.riskCounts.medium})`
                : `Low (${analysis.riskCounts.low})`;

            return (
              <button
                key={level}
                type="button"
                onClick={() => setRiskFilter(level)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {filteredClauses.length > 0 && (
            <button
              type="button"
              onClick={toggleAllVisible}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#0C0C14] px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.05] whitespace-nowrap"
            >
              {anyExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                  <span>Expand All</span>
                </>
              )}
            </button>
          )}

          <select
            aria-label="Filter by clause category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-white/[0.1] bg-[#0C0C14] px-3 py-2 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <div className="relative sm:w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter clauses or quotes..."
              className="w-full rounded-lg border border-white/[0.1] bg-[#0C0C14] py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Clause-by-Clause Findings */}
      <section className="space-y-4">
        {filteredClauses.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0C0C14] p-10 text-center text-sm text-zinc-400">
            No clauses match the current filter criteria.
          </div>
        ) : (
          filteredClauses.map((clause) => {
            const isCollapsed = Boolean(collapsedIds[clause.id]);
            return (
              <article
                key={clause.id}
                className="rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 sm:p-6 transition-colors hover:border-white/[0.14]"
              >
                {/* Clause Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="font-medium text-violet-300">{clause.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Rule: {clause.matchedRuleTitles.join(', ')}</span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-white">
                      {clause.clauseTitle}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenChat(
                          analysis,
                          `Explain the "${clause.clauseTitle}" clause in simple terms and tell me what I should clarify or negotiate before signing.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-violet-500/40 hover:bg-violet-600/15 hover:text-violet-200 whitespace-nowrap"
                    >
                      <MessageSquareText className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                      <span>{t('askAi')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleSpeak({
                          id: `clause-${clause.id}`,
                          title: clause.clauseTitle,
                          text: buildClauseSpeech(clause),
                          languageName: reportSpeechLanguage,
                        })
                      }
                      aria-label={`${t('readClause')}: ${clause.clauseTitle}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        activeItemId === `clause-${clause.id}` && audioStatus !== 'idle'
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-zinc-100'
                      }`}
                    >
                      {activeItemId === `clause-${clause.id}` && audioStatus !== 'idle' ? (
                        <Square className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                      )}
                      <span>
                        {activeItemId === `clause-${clause.id}` && audioStatus !== 'idle'
                          ? t('stopReading')
                          : t('readClause')}
                      </span>
                    </button>
                    <RiskBadge level={clause.riskLevel} />
                    <button
                      type="button"
                      onClick={() => toggleClause(clause.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? `Expand ${clause.clauseTitle}` : `Collapse ${clause.clauseTitle}`}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="mt-5 space-y-5">
                    {/* Plain English & Why It Matters */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 border-t border-white/[0.06] pt-4">
                      <div>
                        <div className="text-xs font-medium text-zinc-400">
                          {t('inSimpleLanguage')}
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
                          {clause.plainEnglish}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <ShieldAlert className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                          <span>{t('whyAttention')}</span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                          {clause.whyItMatters}
                        </p>
                      </div>
                    </div>

                    {/* Exact Original Text Evidence */}
                    <div className="border-t border-white/[0.06] pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <Quote className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                          <span>{t('exactSourceEvidence')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyQuote(clause.id, clause.exactSourceText)}
                          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          {copiedId === clause.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Copy Quote</span>
                            </>
                          )}
                        </button>
                      </div>
                      <blockquote
                        dir="ltr"
                        className="rounded-lg border border-white/[0.07] bg-[#07070C] px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300"
                      >
                        “{clause.exactSourceText}”
                      </blockquote>
                    </div>

                    {/* Questions & Recommendation */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 border-t border-white/[0.06] pt-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <HelpCircle className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                          <span>{t('questionsForLandlord')}</span>
                        </div>
                        <ul className="mt-2 space-y-1.5 text-sm text-zinc-300 list-disc pl-5">
                          {clause.questionsToAsk.map((q, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <Lightbulb className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                          <span>{t('practicalRecommendation')}</span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                          {clause.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
