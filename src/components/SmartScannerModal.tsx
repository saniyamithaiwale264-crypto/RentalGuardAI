import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileCheck2,
  FileText,
  ImagePlus,
  Loader2,
  ScanLine,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import type { AgreementAnalysis, RulebookVersion } from '../types/rental.ts';
import {
  runAgreementAnalysis,
  scanAgreementFilesApi,
  type ScanDocumentResponse,
} from '../services/api.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useReadAloud } from '../context/ReadAloudContext.tsx';
import {
  CUSTOM_LANGUAGE_CODE,
  SUPPORTED_LANGUAGES,
  resolveLanguageLabel,
} from '../utils/languages.ts';

interface SmartScannerModalProps {
  open: boolean;
  rulebooks: RulebookVersion[];
  onClose: () => void;
  onAnalysisComplete: (analysis: AgreementAnalysis) => void;
  onSendToUploadEditor: (payload: {
    title: string;
    fileName: string;
    text: string;
    pageCount: number;
  }) => void;
}

interface QueuedScanPage {
  id: string;
  file: File;
  previewUrl: string | null;
}

export function SmartScannerModal({
  open,
  rulebooks,
  onClose,
  onAnalysisComplete,
  onSendToUploadEditor,
}: SmartScannerModalProps) {
  const { languageCode, customLanguage, t } = useLanguage();
  const { status: audioStatus, activeItemId, toggleSpeak } = useReadAloud();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [pages, setPages] = useState<QueuedScanPage[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<ScanDocumentResponse | null>(null);
  const [title, setTitle] = useState('');
  const [scannedText, setScannedText] = useState('');
  const [selectedRulebookId, setSelectedRulebookId] = useState(rulebooks[0]?.id || '');
  const [outputLangCode, setOutputLangCode] = useState(languageCode);
  const [outputCustomLang, setOutputCustomLang] = useState(customLanguage);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setOutputLangCode(languageCode);
    setOutputCustomLang(customLanguage);
    if (!selectedRulebookId && rulebooks.length > 0) {
      setSelectedRulebookId(rulebooks[0].id);
    }
  }, [open, languageCode, customLanguage, rulebooks, selectedRulebookId, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      pages.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, [stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !scanning && !analyzing) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, scanning, analyzing, onClose]);

  if (!open) return null;

  async function startCamera() {
    setCameraError(null);
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera capture is not supported in this browser. Upload photos or a scanned PDF instead.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      setCameraError(
        `Unable to access camera (${msg}). You can upload lease photos or scanned PDFs directly.`
      );
      stopCamera();
    }
  }

  function handleModeSwitch(nextMode: 'upload' | 'camera') {
    setMode(nextMode);
    if (nextMode === 'upload') {
      stopCamera();
    } else {
      void startCamera();
    }
  }

  function queueFiles(incoming: File[]) {
    setErrorMsg(null);
    const nextPages: QueuedScanPage[] = [];
    for (const file of incoming) {
      if (pages.length + nextPages.length >= 6) break;
      const isImage = file.type.startsWith('image/');
      nextPages.push({
        id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
      });
    }
    setPages((prev) => [...prev, ...nextPages]);
  }

  function removePage(id: string) {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handleCaptureFrame() {
    const video = videoRef.current;
    if (!video || !cameraActive || pages.length >= 6) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const pageNum = pages.length + 1;
        const captured = new File([blob], `lease-scan-page-${pageNum}.png`, {
          type: 'image/png',
        });
        queueFiles([captured]);
      },
      'image/png',
      0.95
    );
  }

  async function handleRunScan() {
    if (pages.length === 0 || scanning) return;
    setErrorMsg(null);
    setScanning(true);
    stopCamera();

    try {
      const result = await scanAgreementFilesApi(pages.map((p) => p.file));
      setScanResult(result);
      setTitle(result.suggestedTitle || 'Scanned Rental Agreement');
      setScannedText(result.extractedText);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to extract text from scanned files.'
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleAnalyzeScanned() {
    const trimmed = scannedText.trim();
    if (trimmed.length < 50) {
      setErrorMsg('Scanned text must be at least 50 characters before analyzing.');
      return;
    }
    if (!selectedRulebookId) {
      setErrorMsg('Please select a rulebook version.');
      return;
    }

    setErrorMsg(null);
    setAnalyzing(true);
    try {
      const analysis = await runAgreementAnalysis({
        title: title.trim() || scanResult?.suggestedTitle || 'Scanned Rental Agreement',
        text: trimmed,
        fileName: scanResult?.fileName || 'scanned-agreement.png',
        sourceType: scanResult?.sourceType || 'pasted',
        pageCount: scanResult?.pageCount || pages.length || 1,
        rulebookVersionId: selectedRulebookId,
        language: resolveLanguageLabel(outputLangCode, outputCustomLang),
      });
      onClose();
      onAnalysisComplete(analysis);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'AI analysis of scanned agreement failed.'
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSendToEditor() {
    if (!scannedText.trim()) return;
    onSendToUploadEditor({
      title: title.trim() || scanResult?.suggestedTitle || 'Scanned Rental Agreement',
      fileName: scanResult?.fileName || 'scanned-agreement.png',
      text: scannedText,
      pageCount: scanResult?.pageCount || pages.length || 1,
    });
    onClose();
  }

  const wordCount = scannedText.trim()
    ? scannedText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-scanner-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-white/[0.12] bg-[#0C0C14] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/35 bg-violet-600/15 text-violet-400">
              <ScanLine className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="smart-scanner-heading"
                className="font-display text-lg font-semibold text-white"
              >
                {t('smartScannerTitle')}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">{t('smartScannerSubtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={scanning || analyzing}
            aria-label="Close Smart Agreement Scanner"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200"
            >
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#07070C] p-1">
              <button
                type="button"
                onClick={() => handleModeSwitch('upload')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'upload'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Upload Photos / Scanned PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('camera')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'camera'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Live Camera Scan</span>
              </button>
            </div>

            <span className="font-mono text-xs text-zinc-400 tabular-nums">
              {pages.length} / 6 pages queued
            </span>
          </div>

          {/* Capture or File Picker */}
          {mode === 'upload' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                queueFiles(Array.from(e.dataTransfer.files));
              }}
              className="rounded-xl border border-dashed border-white/[0.15] bg-[#07070C] p-6 text-center hover:border-violet-500/45 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,.pdf,application/pdf"
                onChange={(e) => {
                  if (e.target.files) {
                    queueFiles(Array.from(e.target.files));
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
              <Upload className="h-7 w-7 text-violet-400 mx-auto" aria-hidden="true" />
              <div className="mt-3 text-sm font-medium text-white">
                Drop lease page photos or scanned PDFs here
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Supports PNG, JPG, WEBP camera photos and scanned PDF files (up to 6 pages, any language).
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pages.length >= 6 || scanning}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Choose Images or PDF</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-[#07070C] p-4 space-y-3">
              {cameraError ? (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-xs text-orange-200">
                  {cameraError}
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-lg bg-black aspect-video max-h-72 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-full w-full object-contain"
                  />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                      Starting camera preview...
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">
                  Hold each lease page flat in bright lighting, then capture.
                </span>
                <div className="flex items-center gap-2">
                  {!cameraActive && (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08]"
                    >
                      Retry Camera
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    disabled={!cameraActive || pages.length >= 6}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Capture Page</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Queued Pages Strip */}
          {pages.length > 0 && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    className="relative rounded-lg border border-white/[0.1] bg-[#07070C] p-2 flex flex-col gap-1.5"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded bg-[#0C0C14] flex items-center justify-center">
                      {p.previewUrl ? (
                        <img
                          src={p.previewUrl}
                          alt={`Scanned lease page ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-violet-400" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-zinc-300">
                      <span className="truncate font-mono">P{idx + 1} · {p.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removePage(p.id)}
                        aria-label={`Remove page ${idx + 1}`}
                        className="text-zinc-500 hover:text-red-400 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleRunScan()}
                disabled={scanning || analyzing}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Scanning Document with Gemini Vision OCR...</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4" aria-hidden="true" />
                    <span>Extract Text with AI Scanner</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* OCR Result & Direct Analysis */}
          {scanResult && (
            <div className="space-y-4 border-t border-white/[0.08] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">
                    Scanned {scanResult.pageCount} page(s) · Detected {scanResult.detectedLanguage} · {wordCount} words
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">{scanResult.scanQualityNote}</span>
                  {scannedText.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void toggleSpeak({
                          id: 'smart-scanner-text',
                          title: title || scanResult.suggestedTitle,
                          text: scannedText,
                          languageName: scanResult.detectedLanguage,
                        })
                      }
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        activeItemId === 'smart-scanner-text' && audioStatus !== 'idle'
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      {activeItemId === 'smart-scanner-text' && audioStatus !== 'idle' ? (
                        <Square className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-violet-400" aria-hidden="true" />
                      )}
                      <span>
                        {activeItemId === 'smart-scanner-text' && audioStatus !== 'idle'
                          ? t('stopReading')
                          : t('readAloud')}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    {t('agreementTitle')}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    {t('rulebookVersion')}
                  </label>
                  <select
                    value={selectedRulebookId}
                    onChange={(e) => setSelectedRulebookId(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
                  >
                    {rulebooks.map((rb) => (
                      <option key={rb.id} value={rb.id}>
                        {rb.versionLabel} — {rb.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    {t('outputLanguageLabel')}
                  </label>
                  <select
                    value={outputLangCode}
                    onChange={(e) => setOutputLangCode(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.nativeName === lang.name
                          ? lang.name
                          : `${lang.nativeName} — ${lang.name}`}
                      </option>
                    ))}
                    <option value={CUSTOM_LANGUAGE_CODE}>+ Any Other Language...</option>
                  </select>
                </div>
              </div>

              {outputLangCode === CUSTOM_LANGUAGE_CODE && (
                <input
                  type="text"
                  value={outputCustomLang}
                  onChange={(e) => setOutputCustomLang(e.target.value)}
                  placeholder={t('customLanguagePlaceholder')}
                  className="w-full rounded-lg border border-white/[0.12] bg-[#07070C] px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
              )}

              <textarea
                value={scannedText}
                onChange={(e) => setScannedText(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-white/[0.08] bg-[#07070C] p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:border-violet-500 focus:outline-none"
              />

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleSendToEditor}
                  disabled={analyzing}
                  className="rounded-lg border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] whitespace-nowrap"
                >
                  Open in Upload Editor
                </button>
                <button
                  type="button"
                  onClick={() => void handleAnalyzeScanned()}
                  disabled={analyzing || scannedText.trim().length < 50}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 whitespace-nowrap"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>{t('analyzingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Analyze Scanned Agreement</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
