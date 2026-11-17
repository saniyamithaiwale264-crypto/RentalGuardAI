import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GitCompare,
  Loader2,
  MinusCircle,
  PlusCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  AgreementAnalysis,
  ClauseDiffItem,
  RulebookVersion,
  VersionComparisonResponse,
} from '../types/rental.ts';
import { compareRulebookVersionsApi } from '../services/api.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { RiskBadge } from './RiskBadge.tsx';

interface CompareViewProps {
  analyses: AgreementAnalysis[];
  rulebooks: RulebookVersion[];
  initialBaselineAnalysisId?: string;
  initialTargetRulebookId?: string;
  onNewAnalysisSaved: () => void;
}

export function CompareView({
  analyses,
  rulebooks,
  initialBaselineAnalysisId,
  initialTargetRulebookId,
  onNewAnalysisSaved,
}: CompareViewProps) {
  const { t } = useLanguage();
  const [baselineId, setBaselineId] = useState<string>(
    initialBaselineAnalysisId || analyses[0]?.id || ''
  );
  const [targetRulebookId, setTargetRulebookId] = useState<string>(
    initialTargetRulebookId || rulebooks[1]?.id || rulebooks[0]?.id || ''
  );
  const [forceReanalyze, setForceReanalyze] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | ClauseDiffItem['status']
  >('ALL');

  const [comparing, setComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [comparison, setComparison] = useState<VersionComparisonResponse | null>(null);

  useEffect(() => {
    if (initialBaselineAnalysisId) {
      setBaselineId(initialBaselineAnalysisId);
    } else if (!baselineId && analyses.length > 0) {
      setBaselineId(analyses[0].id);
    }
  }, [initialBaselineAnalysisId, analyses, baselineId]);

  useEffect(() => {
    if (initialTargetRulebookId) {
      setTargetRulebookId(initialTargetRulebookId);
    } else if (!targetRulebookId && rulebooks.length > 0) {
      setTargetRulebookId(rulebooks[1]?.id || rulebooks[0].id);
    }
  }, [initialTargetRulebookId, rulebooks, targetRulebookId]);

  const selectedBaseline = analyses.find((a) => a.id === baselineId);
  const selectedTarget = rulebooks.find((r) => r.id === targetRulebookId);

  const filteredDiffs = useMemo(() => {
    if (!comparison) return [];
    if (statusFilter === 'ALL') return comparison.diffs;
    return comparison.diffs.filter((d) => d.status === statusFilter);
  }, [comparison, statusFilter]);

  async function handleRunComparison() {
    if (!baselineId || !targetRulebookId) return;
    setErrorMsg(null);
    setComparing(true);
    try {
      const result = await compareRulebookVersionsApi({
        baselineAnalysisId: baselineId,
        targetRulebookVersionId: targetRulebookId,
        forceReanalyze,
      });
      setComparison(result);
      onNewAnalysisSaved();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to compare rulebook versions.'
      );
    } finally {
      setComparing(false);
    }
  }

  function formatDelta(val: number): string {
    if (val > 0) return `+${val}`;
    return `${val}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {t('compareHeading')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Reanalyze the same rental agreement against a newer or customized rulebook version to inspect newly flagged risks, resolved risks, and severity shifts.
        </p>
      </div>

      {/* Controls */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <label
              htmlFor="baseline-analysis-select"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Baseline Agreement Analysis
            </label>
            <select
              id="baseline-analysis-select"
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.rulebookVersionLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center pb-2.5 text-slate-400">
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="lg:col-span-4">
            <label
              htmlFor="target-rulebook-select"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Target Rulebook Version
            </label>
            <select
              id="target-rulebook-select"
              value={targetRulebookId}
              onChange={(e) => setTargetRulebookId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              {rulebooks.map((rb) => (
                <option key={rb.id} value={rb.id}>
                  {rb.versionLabel} — {rb.name} ({rb.rules.filter((r) => r.enabled).length} rules)
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <button
              type="button"
              disabled={comparing || !baselineId || !targetRulebookId}
              onClick={handleRunComparison}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
            >
              {comparing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Comparing...</span>
                </>
              ) : (
                <>
                  <GitCompare className="h-4 w-4" aria-hidden="true" />
                  <span>{t('runCompareBtn')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            {selectedBaseline && (
              <span>
                Baseline: <strong className="text-slate-900">{selectedBaseline.rulebookVersionLabel}</strong>
              </span>
            )}
            <span aria-hidden="true">→</span>
            {selectedTarget && (
              <span>
                Target: <strong className="text-indigo-600">{selectedTarget.versionLabel}</strong> ({selectedTarget.name})
              </span>
            )}
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={forceReanalyze}
              onChange={(e) => setForceReanalyze(e.target.checked)}
              className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500"
            />
            <span>Run fresh AI reanalysis against current rules</span>
          </label>
        </div>
      </section>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>{errorMsg}</div>
        </div>
      )}

      {comparing && (
        <div className="rounded-xl border border-indigo-200 bg-white p-10 text-center shadow-xs space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600 mx-auto" aria-hidden="true" />
          <div className="font-display text-base font-semibold text-slate-900">
            Reanalyzing Agreement Against {selectedTarget?.versionLabel}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Evaluating every lease clause against the updated rulebook definitions and computing clause-level diffs...
          </p>
        </div>
      )}

      {!comparing && !comparison && !errorMsg && (
        <section className="rounded-xl border border-slate-200/90 bg-white p-8 text-center shadow-xs space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600">
            <GitCompare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Ready to Compare Rulebook Versions
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pick a baseline agreement and a target rulebook version above, then click{' '}
              <span className="text-slate-900 font-semibold">{t('runCompareBtn')}</span> to see newly flagged risks, resolved risks, and before-and-after severity changes.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              disabled={!baselineId || !targetRulebookId}
              onClick={handleRunComparison}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('runCompareBtn')}</span>
            </button>
          </div>
        </section>
      )}

      {!comparing && comparison && (
        <div className="space-y-6">
          {/* Before & After Comparison Strip */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-6 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="text-xs font-medium text-slate-600">
                Before &amp; After Risk Counts ({comparison.baselineAnalysis.rulebookVersionLabel} →{' '}
                {comparison.updatedAnalysis.rulebookVersionLabel})
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 font-mono tabular-nums">
                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3">
                  <div className="text-xs font-sans font-semibold text-red-700">High Risk</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {comparison.baselineAnalysis.riskCounts.high} →{' '}
                    {comparison.updatedAnalysis.riskCounts.high}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Delta: {formatDelta(comparison.summary.highDelta)}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                  <div className="text-xs font-sans font-semibold text-amber-800">Medium Risk</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {comparison.baselineAnalysis.riskCounts.medium} →{' '}
                    {comparison.updatedAnalysis.riskCounts.medium}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Delta: {formatDelta(comparison.summary.mediumDelta)}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                  <div className="text-xs font-sans font-semibold text-emerald-700">Low Risk</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {comparison.baselineAnalysis.riskCounts.low} →{' '}
                    {comparison.updatedAnalysis.riskCounts.low}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Delta: {formatDelta(comparison.summary.lowDelta)}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="text-xs font-medium text-slate-600">Rulebook Change Breakdown</div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-sans font-semibold text-red-700">Newly Flagged</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {comparison.summary.newlyFlaggedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-sans font-semibold text-amber-700">Level Changed</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {comparison.summary.changedLevelCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-sans font-semibold text-emerald-700">Resolved</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {comparison.summary.resolvedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-sans font-medium text-slate-600">Unchanged</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {comparison.summary.unchangedCount}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Filter Tabs */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200/90 bg-white p-1 shadow-xs">
            {(
              [
                ['ALL', `All (${comparison.diffs.length})`],
                ['NEW_RISK', `Newly Flagged (${comparison.summary.newlyFlaggedCount})`],
                ['LEVEL_CHANGED', `Level Changed (${comparison.summary.changedLevelCount})`],
                ['RESOLVED_RISK', `Resolved (${comparison.summary.resolvedCount})`],
                ['UNCHANGED', `Unchanged (${comparison.summary.unchangedCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === key
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Diff Cards */}
          <div className="space-y-4">
            {filteredDiffs.map((diff, idx) => (
              <article
                key={`${diff.clauseTitle}-${idx}`}
                className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {diff.status === 'NEW_RISK' && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Newly Flagged Risk</span>
                        </span>
                      )}
                      {diff.status === 'RESOLVED_RISK' && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Resolved Risk</span>
                        </span>
                      )}
                      {diff.status === 'LEVEL_CHANGED' && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                          {diff.riskChangeDirection === 'ESCALATED' ? (
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {diff.riskChangeDirection === 'ESCALATED'
                              ? 'Risk Escalated'
                              : 'Risk Reduced'}
                          </span>
                        </span>
                      )}
                      {diff.status === 'UNCHANGED' && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                          <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Unchanged</span>
                        </span>
                      )}
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-medium text-indigo-600">{diff.category}</span>
                    </div>

                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {diff.clauseTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {diff.before && <RiskBadge level={diff.before.riskLevel} compact />}
                    {diff.before && diff.after && (
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    )}
                    {diff.after && <RiskBadge level={diff.after.riskLevel} compact />}
                  </div>
                </div>

                <p className="text-sm text-slate-700">{diff.changeSummary}</p>

                {/* Before / After detail comparison when changed */}
                {diff.before && diff.after && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 border-t border-slate-200/80 pt-3 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                      <div className="font-semibold text-slate-600">
                        Before ({comparison.baselineAnalysis.rulebookVersionLabel})
                      </div>
                      <div className="text-slate-700 leading-relaxed">
                        {diff.before.whyItMatters}
                      </div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-1">
                      <div className="font-semibold text-indigo-700">
                        After ({comparison.updatedAnalysis.rulebookVersionLabel})
                      </div>
                      <div className="text-slate-800 leading-relaxed">
                        {diff.after.whyItMatters}
                      </div>
                    </div>
                  </div>
                )}

                {diff.exactSourceText && (
                  <blockquote className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-600 leading-relaxed">
                    “{diff.exactSourceText}”
                  </blockquote>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
