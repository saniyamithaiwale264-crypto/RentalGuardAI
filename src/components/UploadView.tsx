import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileCheck2,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  ScanLine,
  Sparkles,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import type { AgreementAnalysis, RulebookVersion } from '../types/rental.ts';
import {
  extractDocumentFile,
  fetchDemoAgreement,
  runAgreementAnalysis,
  scanAgreementFilesApi,
} from '../services/api.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useReadAloud } from '../context/ReadAloudContext.tsx';
import {
  CUSTOM_LANGUAGE_CODE,
  SUPPORTED_LANGUAGES,
  resolveLanguageLabel,
} from '../utils/languages.ts';

interface UploadViewProps {
  rulebooks: RulebookVersion[];
  preloadedDemoTrigger: number;
  preloadedScan?: {
    nonce: number;
    title: string;
    fileName: string;
    text: string;
    pageCount: number;
  } | null;
  onOpenScanner?: () => void;
  onAnalysisComplete: (analysis: AgreementAnalysis) => void;
}

const ANALYSIS_STAGES = [
  'Scanning clauses, dates, and monetary terms',
  'Evaluating clauses against active rulebook criteria',
  'Generating plain-English explanations & landlord questions',
];

export function UploadView({
  rulebooks,
  preloadedDemoTrigger,
  preloadedScan,
  onOpenScanner,
  onAnalysisComplete,
}: UploadViewProps) {
  const { languageCode, customLanguage, t } = useLanguage();
  const { status: audioStatus, activeItemId, toggleSpeak } = useReadAloud();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [sourceType, setSourceType] = useState<'pdf' | 'txt' | 'pasted' | 'demo'>('pasted');
  const [agreementId, setAgreementId] = useState<string | undefined>(undefined);
  const [isDemo, setIsDemo] = useState(false);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [extractedText, setExtractedText] = useState('');
  const [selectedRulebookId, setSelectedRulebookId] = useState<string>(
    rulebooks[0]?.id || ''
  );
  const [outputLangCode, setOutputLangCode] = useState<string>(languageCode);
  const [outputCustomLang, setOutputCustomLang] = useState<string>(customLanguage);

  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStageIdx, setAnalysisStageIdx] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setOutputLangCode(languageCode);
    setOutputCustomLang(customLanguage);
  }, [languageCode, customLanguage]);

  useEffect(() => {
    if (!selectedRulebookId && rulebooks.length > 0) {
      setSelectedRulebookId(rulebooks[0].id);
    }
  }, [rulebooks, selectedRulebookId]);

  useEffect(() => {
    if (preloadedDemoTrigger > 0) {
      void handleLoadDemo();
    }
  }, [preloadedDemoTrigger]);

  useEffect(() => {
    if (!preloadedScan) return;
    setErrorMessage(null);
    setExtractionWarning(null);
    setAgreementId(undefined);
    setIsDemo(false);
    setTitle(preloadedScan.title);
    setFileName(preloadedScan.fileName);
    setSourceType('pasted');
    setPageCount(preloadedScan.pageCount);
    setExtractedText(preloadedScan.text);
  }, [preloadedScan]);

  useEffect(() => {
    if (!analyzing) {
      setAnalysisStageIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setAnalysisStageIdx((prev) => (prev < ANALYSIS_STAGES.length - 1 ? prev + 1 : prev));
    }, 2400);
    return () => clearInterval(timer);
  }, [analyzing]);

  function handleReset() {
    setTitle('');
    setFileName('');
    setSourceType('pasted');
    setAgreementId(undefined);
    setIsDemo(false);
    setPageCount(undefined);
    setExtractedText('');
    setExtractionWarning(null);
    setLastUploadedFile(null);
    setErrorMessage(null);
  }

  async function handleLoadDemo() {
    setErrorMessage(null);
    setExtractionWarning(null);
    try {
      const demo = await fetchDemoAgreement();
      if (typeof demo?.text !== 'string' || !demo.text.trim()) {
        throw new Error('Sample agreement payload was empty or unavailable.');
      }
      setAgreementId(demo.agreementId);
      setTitle(demo.title ?? 'Sample Urban Apartment Lease');
      setFileName(demo.fileName ?? 'sample-oakridge-lease-2026.txt');
      setSourceType('demo');
      setIsDemo(true);
      setPageCount(2);
      setExtractedText(demo.text);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to load sample lease.');
    }
  }

  async function processFile(file: File) {
    setErrorMessage(null);
    setExtractionWarning(null);
    setLastUploadedFile(file);
    setExtracting(true);
    setIsDemo(false);
    setAgreementId(undefined);

    try {
      const result = await extractDocumentFile(file);
      setFileName(result?.fileName ?? file.name);
      setSourceType(result?.sourceType ?? (file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt'));
      setPageCount(result?.pageCount);
      setExtractedText(typeof result?.extractedText === 'string' ? result.extractedText : '');
      setTitle(file.name.replace(/\.(pdf|txt)$/i, ''));

      if (result?.isScannedOrUnreadable && result?.warningMessage) {
        setExtractionWarning(result.warningMessage);
      }
    } catch (err) {
      setExtractedText('');
      setFileName(file.name);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to extract text from document.'
      );
    } finally {
      setExtracting(false);
    }
  }

  async function handleRescueScannedPdf() {
    if (!lastUploadedFile || ocrScanning) return;
    setErrorMessage(null);
    setOcrScanning(true);
    try {
      const scan = await scanAgreementFilesApi([lastUploadedFile]);
      setExtractedText(scan.extractedText);
      setTitle((prev) => prev.trim() || scan.suggestedTitle);
      setPageCount(scan.pageCount);
      setExtractionWarning(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to scan this PDF with Gemini Vision OCR.'
      );
    } finally {
      setOcrScanning(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  const safeText = typeof extractedText === 'string' ? extractedText : '';
  const safeTitle = typeof title === 'string' ? title : '';

  async function handleAnalyze() {
    setErrorMessage(null);
    const trimmed = safeText.trim();
    if (trimmed.length < 50) {
      setErrorMessage(
        'Please upload a readable document or paste at least 50 characters of rental agreement text before analyzing.'
      );
      return;
    }

    if (!selectedRulebookId) {
      setErrorMessage('Please select a rulebook version.');
      return;
    }

    const chosenLanguage = resolveLanguageLabel(outputLangCode, outputCustomLang);
    setAnalyzing(true);
    try {
      const result = await runAgreementAnalysis({
        agreementId,
        title: safeTitle.trim() || fileName || 'Rental Agreement Review',
        text: trimmed,
        fileName: fileName || 'pasted-agreement.txt',
        sourceType,
        isDemo,
        pageCount,
        rulebookVersionId: selectedRulebookId,
        language: chosenLanguage,
      });
      onAnalysisComplete(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'AI analysis failed. Please try again.'
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const wordCount = safeText.trim()
    ? safeText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const hasReadyText = safeText.trim().length >= 50;
  const activeRulebook = rulebooks.find((rb) => rb.id === selectedRulebookId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {t('uploadHeading')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('uploadSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              disabled={analyzing || extracting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <ScanLine className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              <span>{t('smartScannerBtn')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={analyzing || extracting}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>{t('loadSampleDemo')}</span>
          </button>
        </div>
      </div>

      {/* Guided 3-Step Progress Strip */}
      <nav
        aria-label="Upload and Analysis Steps"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs"
      >
        <div
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs ${
            hasReadyText ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800'
          }`}
        >
          {hasReadyText ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
          ) : (
            <span className="font-mono font-semibold text-indigo-600 shrink-0">01</span>
          )}
          <span className="font-medium truncate">Upload PDF / TXT or Paste Lease</span>
        </div>

        <div
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs ${
            hasReadyText
              ? 'bg-indigo-50 text-indigo-800'
              : 'text-slate-400'
          }`}
        >
          <span className="font-mono font-semibold shrink-0">02</span>
          <span className="font-medium truncate">Review Extracted Text ({wordCount} words)</span>
        </div>

        <div
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs ${
            analyzing
              ? 'bg-indigo-50 text-indigo-800'
              : hasReadyText
              ? 'text-slate-700'
              : 'text-slate-400'
          }`}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" aria-hidden="true" />
          ) : (
            <span className="font-mono font-semibold shrink-0">03</span>
          )}
          <span className="font-medium truncate">
            {analyzing ? 'Analyzing with Gemini AI...' : 'Select Rulebook & Analyze'}
          </span>
        </div>
      </nav>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-semibold text-red-900">Document or Analysis Issue</div>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Scanned / Unreadable Warning Banner */}
      {extractionWarning && (
        <div
          role="status"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <div className="font-semibold text-amber-900">
                Unreadable or Scanned PDF Detected
              </div>
              <p className="mt-0.5 text-amber-800">{extractionWarning}</p>
            </div>
          </div>
          {lastUploadedFile && (
            <button
              type="button"
              onClick={() => void handleRescueScannedPdf()}
              disabled={ocrScanning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {ocrScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Scanning with AI OCR...</span>
                </>
              ) : (
                <>
                  <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Scan PDF with AI OCR</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left column: Upload & Config */}
        <div className="space-y-5 xl:col-span-5">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-xl border border-dashed p-6 text-center shadow-xs transition-colors ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/70'
                : 'border-slate-300 bg-white hover:border-indigo-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600">
              {extracting ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              ) : (
                <FileUp className="h-6 w-6" aria-hidden="true" />
              )}
            </div>

            <h2 className="mt-4 font-display text-base font-semibold text-slate-900">
              {extracting ? 'Extracting Document Text...' : 'Drop PDF or TXT Agreement Here'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 max-w-xs mx-auto">
              Supports text-based PDFs and UTF-8 plain text files up to 10 MB. Scanned PDFs are flagged automatically.
            </p>

            <div className="mt-5 flex justify-center">
              <button
                type="button"
                disabled={extracting || analyzing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                <span>Choose File</span>
              </button>
            </div>
          </div>

          {/* Analysis Configuration */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {t('analysisSettings')}
            </h2>

            <div>
              <label
                htmlFor="agreement-title"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                {t('agreementTitle')}
              </label>
              <input
                id="agreement-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Sunset Apartments 12-Month Lease"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="rulebook-select"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                {t('rulebookVersion')}
              </label>
              <select
                id="rulebook-select"
                value={selectedRulebookId}
                onChange={(e) => setSelectedRulebookId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {rulebooks.map((rb) => (
                  <option key={rb.id} value={rb.id}>
                    {rb.versionLabel} — {rb.name} ({rb.rules.filter((r) => r.enabled).length} rules)
                  </option>
                ))}
              </select>
              {activeRulebook && (
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  {activeRulebook.description}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="output-language-select"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                {t('outputLanguageLabel')}
              </label>
              <select
                id="output-language-select"
                value={outputLangCode}
                onChange={(e) => setOutputLangCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName === lang.name
                      ? lang.name
                      : `${lang.nativeName} — ${lang.name}`}
                  </option>
                ))}
                <option value={CUSTOM_LANGUAGE_CODE}>
                  + Any Other Language (Custom)...
                </option>
              </select>

              {outputLangCode === CUSTOM_LANGUAGE_CODE && (
                <input
                  type="text"
                  value={outputCustomLang}
                  onChange={(e) => setOutputCustomLang(e.target.value)}
                  placeholder={t('customLanguagePlaceholder')}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              )}
            </div>

            <button
              type="button"
              disabled={analyzing || extracting || !hasReadyText}
              onClick={handleAnalyze}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{t('analyzingBtn')}</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t('runAnalysisBtn')}</span>
                </>
              )}
            </button>

            {!hasReadyText && !analyzing && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Next step: upload a PDF/TXT file, use Smart Agreement Scanner for paper photos, or click Load Sample Demo above.
              </p>
            )}

            {analyzing && (
              <div
                aria-live="polite"
                className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3.5 space-y-2"
              >
                {ANALYSIS_STAGES.map((stage, idx) => {
                  const done = idx < analysisStageIdx;
                  const current = idx === analysisStageIdx;
                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-2 text-xs ${
                        done
                          ? 'text-emerald-700'
                          : current
                          ? 'text-indigo-700 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                      ) : current ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" aria-hidden="true" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                      )}
                      <span>{stage}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Analysis runs securely on the server. Findings provide informational guidance only and are not legal advice.
            </p>
          </div>
        </div>

        {/* Right column: Extracted Text Review */}
        <div className="xl:col-span-7 flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              <span className="font-display text-sm font-semibold text-slate-900">
                {t('extractedTextTitle')}
              </span>
              {isDemo && (
                <span className="text-xs font-semibold text-indigo-600">
                  · Sample Demo Document
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-slate-500 tabular-nums">
              {fileName && <span>{fileName}</span>}
              {pageCount !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{wordCount} words</span>
              {safeText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    void toggleSpeak({
                      id: 'upload-extracted-text',
                      title: safeTitle.trim() || fileName || t('extractedTextTitle'),
                      text: safeText,
                      languageName: resolveLanguageLabel(outputLangCode, outputCustomLang),
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-sans text-[11px] font-medium transition-colors whitespace-nowrap ${
                    activeItemId === 'upload-extracted-text' && audioStatus !== 'idle'
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {activeItemId === 'upload-extracted-text' && audioStatus !== 'idle' ? (
                    <Square className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                  )}
                  <span>
                    {activeItemId === 'upload-extracted-text' && audioStatus !== 'idle'
                      ? t('stopReading')
                      : t('readAloud')}
                  </span>
                </button>
              )}
              {(safeText.length > 0 || fileName) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={analyzing || extracting}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-sans text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>{t('clearBtn')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col">
            <label htmlFor="extracted-text-area" className="sr-only">
              Extracted rental agreement text
            </label>
            <textarea
              id="extracted-text-area"
              value={safeText}
              onChange={(e) => {
                setExtractedText(e.target.value);
                if (!fileName) setSourceType('pasted');
              }}
              placeholder="Extracted text from your uploaded PDF or TXT file will appear here for review. You can also paste rental agreement text directly..."
              rows={18}
              className="w-full flex-1 min-h-[400px] resize-y rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs sm:text-[13px] leading-relaxed text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
