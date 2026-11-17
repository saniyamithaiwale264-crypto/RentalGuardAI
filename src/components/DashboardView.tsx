import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  GitCompare,
  MessageSquareText,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AgreementAnalysis } from '../types/rental.ts';
import { computeRiskScore } from '../utils/riskScore.ts';
import { generateAgreementPdfReport } from '../utils/pdfReport.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { RiskScoreGauge } from './RiskScoreGauge.tsx';

interface DashboardViewProps {
  totalAgreementsAnalyzed: number;
  riskTotals: { high: number; medium: number; low: number };
  analyses: AgreementAnalysis[];
  loading: boolean;
  onGoToUpload: () => void;
  onLoadSampleInUpload: () => void;
  onOpenScanner: () => void;
  onOpenAnalysis: (analysis: AgreementAnalysis) => void;
  onOpenCompare: (analysis: AgreementAnalysis) => void;
  onOpenChat: (analysis: AgreementAnalysis) => void;
  onDeleteAnalysis: (id: string) => void;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DashboardView({
  totalAgreementsAnalyzed,
  riskTotals,
  analyses,
  loading,
  onGoToUpload,
  onLoadSampleInUpload,
  onOpenScanner,
  onOpenAnalysis,
  onOpenCompare,
  onOpenChat,
  onDeleteAnalysis,
}: DashboardViewProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const filteredAnalyses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return analyses;
    return analyses.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.fileName.toLowerCase().includes(q) ||
        a.rulebookVersionLabel.toLowerCase().includes(q)
    );
  }, [analyses, search]);

  const sampleAnalysis = analyses.find((a) => a.isDemo) || analyses[0];
  const latestAnalysis = analyses[0];

  const latestRiskScore = latestAnalysis
    ? typeof latestAnalysis.riskScore === 'number'
      ? latestAnalysis.riskScore
      : computeRiskScore(latestAnalysis.riskCounts)
    : 0;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { category: string; high: number; medium: number; low: number; total: number }
    >();
    for (const a of analyses) {
      for (const c of a.clauses) {
        const cur = map.get(c.category) || {
          category: c.category,
          high: 0,
          medium: 0,
          low: 0,
          total: 0,
        };
        if (c.riskLevel === 'HIGH') cur.high++;
        else if (c.riskLevel === 'MEDIUM') cur.medium++;
        else cur.low++;
        cur.total++;
        map.set(c.category, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.high * 3 + b.medium * 2 + b.low - (a.high * 3 + a.medium * 2 + a.low))
      .slice(0, 6);
  }, [analyses]);

  const totalFlagged = riskTotals.high + riskTotals.medium + riskTotals.low;
  const safeDenominator = Math.max(totalFlagged, 1);
  const highArc = (riskTotals.high / safeDenominator) * 100;
  const medArc = (riskTotals.medium / safeDenominator) * 100;
  const lowArc = totalFlagged > 0 ? Math.max(0, 100 - highArc - medArc) : 0;

  const donutRadius = 28;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const highDash = (highArc / 100) * donutCircumference;
  const medDash = (medArc / 100) * donutCircumference;
  const lowDash = (lowArc / 100) * donutCircumference;

  const recommendedActions = useMemo(() => {
    if (!latestAnalysis) return [];
    if (latestAnalysis.recommendedActions && latestAnalysis.recommendedActions.length > 0) {
      return latestAnalysis.recommendedActions.slice(0, 4);
    }
    return latestAnalysis.clauses
      .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
      .slice(0, 4)
      .map((c) => c.recommendation)
      .filter(Boolean);
  }, [latestAnalysis]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C0C14] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="text-xs font-medium tracking-wide text-violet-400">
              {t('welcomeBadge')}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              {t('tagline')}
            </h1>
            <p className="text-sm sm:text-[15px] leading-relaxed text-zinc-400">
              {t('welcomeDesc')}
            </p>
          </div>

          <div className="space-y-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onGoToUpload}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-950/50 transition-colors hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{t('uploadAgreementBtn')}</span>
              </button>

              <button
                type="button"
                onClick={onLoadSampleInUpload}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>{t('tryDemoLeaseBtn')}</span>
              </button>

              <button
                type="button"
                onClick={onOpenScanner}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-500/35 bg-violet-600/15 px-4 py-2.5 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 whitespace-nowrap shrink-0"
              >
                <ScanLine className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>{t('smartScannerBtn')}</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              No sign-up needed · Upload PDF/TXT, scan paper photos, or try the demo lease in seconds
            </p>
          </div>
        </div>
      </section>

      {/* Guided 3-Step Workflow Strip */}
      <section aria-label="How RentalGuard AI Works" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={onGoToUpload}
          className="group text-left rounded-xl border border-white/[0.08] bg-[#0C0C14] p-4 transition-colors hover:border-violet-500/40 hover:bg-[#0E0E18]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-violet-400">01 · {t('navUpload')}</span>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 font-display text-sm font-semibold text-white">
            {t('step1Title')}
          </div>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Drop a PDF or TXT agreement, verify the extracted text, or load the built-in sample lease.
          </p>
        </button>

        <button
          type="button"
          onClick={() => (sampleAnalysis ? onOpenAnalysis(sampleAnalysis) : onGoToUpload())}
          className="group text-left rounded-xl border border-white/[0.08] bg-[#0C0C14] p-4 transition-colors hover:border-violet-500/40 hover:bg-[#0E0E18]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-violet-400">02 · {t('navResults')}</span>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 font-display text-sm font-semibold text-white">
            {t('step2Title')}
          </div>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Inspect High, Medium, and Low risk clauses with exact verbatim quotes and landlord questions.
          </p>
        </button>

        <button
          type="button"
          onClick={() => (sampleAnalysis ? onOpenChat(sampleAnalysis) : onGoToUpload())}
          className="group text-left rounded-xl border border-white/[0.08] bg-[#0C0C14] p-4 transition-colors hover:border-violet-500/40 hover:bg-[#0E0E18]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-violet-400">03 · {t('askAi')}</span>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 font-display text-sm font-semibold text-white">
            {t('step3Title')}
          </div>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Ask the grounded AI chat, compare rulebook versions, or download a clean PDF report.
          </p>
        </button>
      </section>

      {/* KPI Metrics Row */}
      <section aria-label="Analysis Summary Metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 transition-colors hover:border-white/[0.15]">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
              <span>{t('kpiAgreements')}</span>
              <FileText className="h-4 w-4 text-violet-400" aria-hidden="true" />
            </div>
            <div className="mt-3 font-mono text-3xl font-semibold text-white tabular-nums">
              {loading ? '—' : totalAgreementsAnalyzed}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500">
              Stored analyses across rulebooks
            </div>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-[#0C0C14] p-5 transition-colors hover:border-red-500/35">
            <div className="flex items-center justify-between text-xs font-medium text-red-400">
              <span>{t('kpiHighRisk')}</span>
              <AlertOctagon className="h-4 w-4 text-red-400" aria-hidden="true" />
            </div>
            <div className="mt-3 font-mono text-3xl font-semibold text-white tabular-nums">
              {loading ? '—' : riskTotals.high}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500">
              Requires immediate attention
            </div>
          </div>

          <div className="rounded-xl border border-orange-500/20 bg-[#0C0C14] p-5 transition-colors hover:border-orange-500/35">
            <div className="flex items-center justify-between text-xs font-medium text-orange-400">
              <span>{t('kpiMediumRisk')}</span>
              <AlertTriangle className="h-4 w-4 text-orange-400" aria-hidden="true" />
            </div>
            <div className="mt-3 font-mono text-3xl font-semibold text-white tabular-nums">
              {loading ? '—' : riskTotals.medium}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500">
              Worth clarifying before signing
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-[#0C0C14] p-5 transition-colors hover:border-emerald-500/35">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-400">
              <span>{t('kpiLowRisk')}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="mt-3 font-mono text-3xl font-semibold text-white tabular-nums">
              {loading ? '—' : riskTotals.low}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500">
              Standard or minor advisory terms
            </div>
          </div>
        </div>
      </section>

      {/* Smart Risk Analytics: Risk Score Gauge, Category Chart & Recommended Actions */}
      {latestAnalysis && (
        <section
          aria-label="Smart Risk Analytics"
          className="grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          {/* Risk Score & Donut Distribution */}
          <div className="lg:col-span-4 rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 flex flex-col justify-between space-y-5 transition-colors hover:border-white/[0.15]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-white">
                  {t('smartRiskScore')}
                </h2>
                <span className="text-[11px] text-zinc-400 truncate max-w-[140px]">
                  {latestAnalysis.isSampleResult ? 'Sample Demo' : 'Latest Analysis'}
                </span>
              </div>
              <div className="mt-4">
                <RiskScoreGauge score={latestRiskScore} />
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-4">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
                <span>Portfolio Clause Distribution</span>
                <span className="font-mono tabular-nums">
                  {totalFlagged} total
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative h-[72px] w-[72px] shrink-0 flex items-center justify-center">
                  <svg
                    width={72}
                    height={72}
                    viewBox="0 0 72 72"
                    className="-rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx={36}
                      cy={36}
                      r={donutRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth={8}
                    />
                    {riskTotals.low > 0 && (
                      <circle
                        cx={36}
                        cy={36}
                        r={donutRadius}
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth={8}
                        strokeDasharray={`${lowDash} ${donutCircumference}`}
                        strokeDashoffset={-(highDash + medDash)}
                      />
                    )}
                    {riskTotals.medium > 0 && (
                      <circle
                        cx={36}
                        cy={36}
                        r={donutRadius}
                        fill="none"
                        stroke="#F97316"
                        strokeWidth={8}
                        strokeDasharray={`${medDash} ${donutCircumference}`}
                        strokeDashoffset={-highDash}
                      />
                    )}
                    {riskTotals.high > 0 && (
                      <circle
                        cx={36}
                        cy={36}
                        r={donutRadius}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={8}
                        strokeDasharray={`${highDash} ${donutCircumference}`}
                        strokeDashoffset={0}
                      />
                    )}
                  </svg>
                  <span className="absolute font-mono text-xs font-semibold text-white tabular-nums">
                    {totalFlagged}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-red-400">
                      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                      High
                    </span>
                    <span className="text-zinc-300">
                      {riskTotals.high} ({Math.round(highArc)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-orange-400">
                      <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
                      Medium
                    </span>
                    <span className="text-zinc-300">
                      {riskTotals.medium} ({Math.round(medArc)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      Low
                    </span>
                    <span className="text-zinc-300">
                      {riskTotals.low} ({Math.round(lowArc)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Risk Breakdown Chart */}
          <div className="lg:col-span-4 rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 transition-colors hover:border-white/[0.15]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">
                {t('riskByCategory')}
              </h2>
              <span className="text-[11px] text-zinc-500">Top categories</span>
            </div>

            <div className="mt-4 space-y-3">
              {categoryBreakdown.map((cat) => {
                const maxTotal = Math.max(
                  ...categoryBreakdown.map((item) => item.total),
                  1
                );
                const wHigh = (cat.high / maxTotal) * 100;
                const wMed = (cat.medium / maxTotal) * 100;
                const wLow = (cat.low / maxTotal) * 100;

                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 truncate max-w-[75%]">
                        {cat.category}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                        {cat.total}
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                      {cat.high > 0 && (
                        <div style={{ width: `${wHigh}%` }} className="bg-red-500" />
                      )}
                      {cat.medium > 0 && (
                        <div style={{ width: `${wMed}%` }} className="bg-orange-500" />
                      )}
                      {cat.low > 0 && (
                        <div style={{ width: `${wLow}%` }} className="bg-emerald-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Important Findings & Recommended Actions */}
          <div className="lg:col-span-4 rounded-xl border border-white/[0.08] bg-[#0C0C14] p-5 flex flex-col justify-between space-y-4 transition-colors hover:border-white/[0.15]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-white">
                  {t('recommendedActions')}
                </h2>
                <span className="text-[11px] text-violet-300 truncate max-w-[140px]">
                  {latestAnalysis.rulebookVersionLabel}
                </span>
              </div>

              <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                {recommendedActions.map((act, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="font-mono text-[11px] text-violet-400 shrink-0 mt-0.5">
                      0{idx + 1}.
                    </span>
                    <span className="line-clamp-2">{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
              <button
                type="button"
                onClick={() => onOpenAnalysis(latestAnalysis)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] whitespace-nowrap"
              >
                <span>{t('viewReport')}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenChat(latestAnalysis)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-600/15 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-600/25 whitespace-nowrap"
              >
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('askAiChat')}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Instant Hackathon Demo Strip */}
      {sampleAnalysis && (
        <section className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-violet-300 font-medium">
                <span>Sample Demo Experience</span>
                <span aria-hidden="true">·</span>
                <span>No file upload required</span>
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                {sampleAnalysis.title}
              </h2>
              <p className="text-sm text-zinc-400 max-w-2xl">
                Explore pre-generated sample results ({sampleAnalysis.riskCounts.high} High,{' '}
                {sampleAnalysis.riskCounts.medium} Medium, {sampleAnalysis.riskCounts.low} Low risk clauses) or compare how risk severity shifts between rulebook v1.0 and v1.1.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onOpenAnalysis(sampleAnalysis)}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600/20 border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-600/30 whitespace-nowrap"
              >
                <span>{t('viewReport')}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onOpenCompare(sampleAnalysis)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.07] whitespace-nowrap"
              >
                <GitCompare className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>{t('compare')}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent Analysis History */}
      <section className="rounded-xl border border-white/[0.08] bg-[#0C0C14]">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              {t('recentHistory')}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select any agreement to inspect clause evidence, chat with AI, or run a rulebook comparison.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchAgreements')}
              className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-white/[0.06] px-6 py-4">
            {[1, 2, 3].map((row) => (
              <div key={row} className="py-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="space-y-2 w-1/2">
                  <div className="h-4 bg-white/[0.06] rounded w-3/4" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/2" />
                </div>
                <div className="h-7 bg-white/[0.06] rounded w-36" />
              </div>
            ))}
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-300">
              {search ? 'No analyses match your search.' : 'No rental agreements analyzed yet.'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Upload a PDF or TXT rental agreement, or load the built-in sample lease to get started.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={onGoToUpload}
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                {t('uploadAgreementBtn')}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredAnalyses.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02] lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAnalysis(item)}
                      className="text-left font-medium text-sm text-white hover:text-violet-300 transition-colors truncate max-w-xl"
                    >
                      {item.title}
                    </button>
                    {item.isSampleResult && (
                      <span className="text-[11px] font-medium text-violet-400">
                        · Sample Demo Result
                      </span>
                    )}
                    {item.language && item.language !== 'English' && (
                      <span className="text-[11px] font-medium text-zinc-400">
                        · {item.language}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="font-mono">{formatDate(item.analyzedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Rulebook {item.rulebookVersionLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.fileName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.wordCount} words</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 lg:justify-end shrink-0">
                  <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                    <span className="text-zinc-300 font-medium">
                      Score{' '}
                      {typeof item.riskScore === 'number'
                        ? item.riskScore
                        : computeRiskScore(item.riskCounts)}
                      /100
                    </span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-red-400 font-medium">
                      {item.riskCounts.high} High
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-orange-400 font-medium">
                      {item.riskCounts.medium} Med
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-emerald-400 font-medium">
                      {item.riskCounts.low} Low
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAnalysis(item)}
                      className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
                    >
                      {t('viewReport')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChat(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-500/35 bg-violet-600/15 px-2.5 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-600/25 whitespace-nowrap"
                    >
                      <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('askAi')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCompare(item)}
                      className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
                    >
                      {t('compare')}
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAgreementPdfReport(item)}
                      title="Download PDF report"
                      aria-label={`Download PDF report for ${item.title}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                      <span>PDF</span>
                    </button>
                    {!item.isSampleResult && (
                      <button
                        type="button"
                        onClick={() => onDeleteAnalysis(item.id)}
                        title="Delete analysis"
                        aria-label={`Delete ${item.title}`}
                        className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
