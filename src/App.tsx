import { useCallback, useEffect, useState } from 'react';
import { Menu, Upload } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { AgreementAnalysis, RulebookVersion } from './types/rental.ts';
import { deleteAnalysisById, fetchDashboard } from './services/api.ts';
import { useLanguage } from './context/LanguageContext.tsx';
import type { UiKey } from './utils/i18n.ts';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { UploadView } from './components/UploadView.tsx';
import { ResultsView } from './components/ResultsView.tsx';
import { RulebookView } from './components/RulebookView.tsx';
import { CompareView } from './components/CompareView.tsx';
import { ChatAssistantView } from './components/ChatAssistantView.tsx';
import { ReadAloudBar } from './components/ReadAloudBar.tsx';
import { SmartScannerModal } from './components/SmartScannerModal.tsx';

const TAB_LABEL_KEYS: Record<NavTab, UiKey> = {
  dashboard: 'navDashboard',
  upload: 'navUpload',
  results: 'navResults',
  chat: 'navChat',
  rulebook: 'navRulebook',
  compare: 'navCompare',
};

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalAgreements, setTotalAgreements] = useState(0);
  const [riskTotals, setRiskTotals] = useState({ high: 0, medium: 0, low: 0 });
  const [analyses, setAnalyses] = useState<AgreementAnalysis[]>([]);
  const [rulebooks, setRulebooks] = useState<RulebookVersion[]>([]);

  const [activeAnalysis, setActiveAnalysis] = useState<AgreementAnalysis | null>(null);
  const [compareBaselineId, setCompareBaselineId] = useState<string | undefined>(undefined);
  const [compareTargetRulebookId, setCompareTargetRulebookId] = useState<string | undefined>(
    undefined
  );
  const [chatAnalysisId, setChatAnalysisId] = useState<string | undefined>(undefined);
  const [prefilledChatQuestion, setPrefilledChatQuestion] = useState<{
    nonce: number;
    analysisId: string;
    text: string;
  } | null>(null);
  const [demoTrigger, setDemoTrigger] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [preloadedScan, setPreloadedScan] = useState<{
    nonce: number;
    title: string;
    fileName: string;
    text: string;
    pageCount: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await fetchDashboard();
      setTotalAgreements(data.totalAgreementsAnalyzed);
      setRiskTotals(data.riskTotals);
      setAnalyses(data.analyses);
      setRulebooks(data.rulebooks);
      setActiveAnalysis((prev) => {
        if (prev && data.analyses.some((a) => a.id === prev.id)) {
          return data.analyses.find((a) => a.id === prev.id) || prev;
        }
        return data.analyses[0] || null;
      });
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to connect to RentalGuard AI backend.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleAnalysisComplete(newAnalysis: AgreementAnalysis) {
    setActiveAnalysis(newAnalysis);
    setActiveTab('results');
    void loadData();
  }

  async function handleDeleteAnalysis(id: string) {
    try {
      await deleteAnalysisById(id);
      if (activeAnalysis?.id === id) {
        setActiveAnalysis(null);
      }
      await loadData();
    } catch {
      // Keep current state if delete fails
    }
  }

  return (
    <div className="relative min-h-screen bg-[#06060A] text-zinc-100 flex">
      {/* Subtle ambient electric-purple top atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_70%_50%_at_55%_-10%,rgba(139,92,246,0.12),transparent_70%)]"
      />

      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasActiveResult={Boolean(activeAnalysis)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="relative flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-[#06060A]/85 backdrop-blur-md px-4 sm:px-8 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-2 text-zinc-300 hover:bg-white/[0.06]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="font-display font-semibold text-zinc-400 whitespace-nowrap">
                RentalGuard AI
              </span>
              <span className="text-zinc-600" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-white truncate">
                {t(TAB_LABEL_KEYS[activeTab])}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-violet-950/50 transition-colors hover:bg-violet-500 whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('uploadAgreementBtn')}</span>
          </button>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-[1320px] w-full mx-auto">
          {loadError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-center justify-between gap-4"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-lg border border-red-400/40 px-3 py-1 text-xs font-medium text-red-100 hover:bg-red-500/20 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  totalAgreementsAnalyzed={totalAgreements}
                  riskTotals={riskTotals}
                  analyses={analyses}
                  loading={loading}
                  onGoToUpload={() => setActiveTab('upload')}
                  onLoadSampleInUpload={() => {
                    setDemoTrigger((n) => n + 1);
                    setActiveTab('upload');
                  }}
                  onOpenScanner={() => setScannerOpen(true)}
                  onOpenAnalysis={(analysis) => {
                    setActiveAnalysis(analysis);
                    setActiveTab('results');
                  }}
                  onOpenCompare={(analysis) => {
                    setCompareBaselineId(analysis.id);
                    setActiveTab('compare');
                  }}
                  onOpenChat={(analysis) => {
                    setChatAnalysisId(analysis.id);
                    setActiveTab('chat');
                  }}
                  onDeleteAnalysis={(id) => void handleDeleteAnalysis(id)}
                />
              )}

              {activeTab === 'upload' && (
                <UploadView
                  rulebooks={rulebooks}
                  preloadedDemoTrigger={demoTrigger}
                  preloadedScan={preloadedScan}
                  onOpenScanner={() => setScannerOpen(true)}
                  onAnalysisComplete={handleAnalysisComplete}
                />
              )}

              {activeTab === 'results' && activeAnalysis && (
                <ResultsView
                  analysis={activeAnalysis}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                  onAnalysisUpdated={(updated) => {
                    setActiveAnalysis(updated);
                    setAnalyses((prev) =>
                      prev.map((a) => (a.id === updated.id ? updated : a))
                    );
                  }}
                  onCompareVersion={(analysis) => {
                    setCompareBaselineId(analysis.id);
                    setActiveTab('compare');
                  }}
                  onOpenChat={(analysis, prefilledQuestion) => {
                    setChatAnalysisId(analysis.id);
                    if (prefilledQuestion) {
                      setPrefilledChatQuestion({
                        nonce: Date.now(),
                        analysisId: analysis.id,
                        text: prefilledQuestion,
                      });
                    }
                    setActiveTab('chat');
                  }}
                />
              )}

              {activeTab === 'chat' && (
                <ChatAssistantView
                  analyses={analyses}
                  initialAnalysisId={chatAnalysisId || activeAnalysis?.id}
                  prefilledQuestion={prefilledChatQuestion}
                />
              )}

              {activeTab === 'rulebook' && (
                <RulebookView
                  rulebooks={rulebooks}
                  onRulebooksChanged={(updated) => setRulebooks(updated)}
                  onGoToCompareWithVersion={(versionId) => {
                    setCompareTargetRulebookId(versionId);
                    setActiveTab('compare');
                  }}
                />
              )}

              {activeTab === 'compare' && (
                <CompareView
                  analyses={analyses}
                  rulebooks={rulebooks}
                  initialBaselineAnalysisId={compareBaselineId}
                  initialTargetRulebookId={compareTargetRulebookId}
                  onNewAnalysisSaved={() => void loadData()}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ReadAloudBar />

      <SmartScannerModal
        open={scannerOpen}
        rulebooks={rulebooks}
        onClose={() => setScannerOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
        onSendToUploadEditor={(payload) => {
          setPreloadedScan({ ...payload, nonce: Date.now() });
          setActiveTab('upload');
        }}
      />
    </div>
  );
}
