import { Loader2, Pause, Play, Sparkles, Square, Volume2, X } from 'lucide-react';
import { useReadAloud, type AiVoiceName } from '../context/ReadAloudContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';

const SPEED_OPTIONS = [1, 1.15, 1.25, 0.85, 0.95];

const AI_VOICES: Array<{ id: AiVoiceName; label: string }> = [
  { id: 'Kore', label: 'Kore (Clear)' },
  { id: 'Zephyr', label: 'Zephyr (Warm)' },
  { id: 'Charon', label: 'Charon (Deep)' },
  { id: 'Puck', label: 'Puck (Bright)' },
];

export function ReadAloudBar() {
  const {
    status,
    activeTitle,
    engine,
    voiceName,
    rate,
    errorMessage,
    pause,
    resume,
    stop,
    setRate,
    switchEngine,
    switchVoice,
    dismissError,
  } = useReadAloud();
  const { t } = useLanguage();

  if (status === 'idle' && !errorMessage) {
    return null;
  }

  function cycleSpeed() {
    const idx = SPEED_OPTIONS.indexOf(rate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setRate(next);
  }

  return (
    <div
      role="region"
      aria-label={t('readAloud')}
      className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-md rounded-xl border border-indigo-200 bg-white/95 backdrop-blur-md p-3.5 shadow-xl shadow-slate-900/10"
    >
      {errorMessage ? (
        <div className="flex items-start justify-between gap-3 text-xs text-red-700">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss audio error"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {status === 'loading' ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-indigo-600 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Volume2 className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {activeTitle || t('readAloud')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {status === 'loading'
                    ? t('preparingAudio')
                    : engine === 'ai'
                    ? `${t('aiVoice')} · ${voiceName}`
                    : t('browserVoice')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {status === 'playing' && (
                <button
                  type="button"
                  onClick={pause}
                  aria-label={t('pauseReading')}
                  title={t('pauseReading')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('pauseReading')}</span>
                </button>
              )}

              {status === 'paused' && (
                <button
                  type="button"
                  onClick={resume}
                  aria-label={t('resumeReading')}
                  title={t('resumeReading')}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('resumeReading')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={stop}
                aria-label={t('stopReading')}
                title={t('stopReading')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 whitespace-nowrap"
              >
                <Square className="h-3 w-3" aria-hidden="true" />
                <span>{t('stopReading')}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 text-[11px]">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => void switchEngine('ai')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors whitespace-nowrap ${
                  engine === 'ai'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>{t('aiVoice')}</span>
              </button>
              <button
                type="button"
                onClick={() => void switchEngine('browser')}
                className={`rounded px-2 py-1 font-medium transition-colors whitespace-nowrap ${
                  engine === 'browser'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('browserVoice')}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {engine === 'ai' && (
                <select
                  aria-label="AI Voice selection"
                  value={voiceName}
                  onChange={(e) => void switchVoice(e.target.value as AiVoiceName)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  {AI_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={cycleSpeed}
                aria-label={`Playback speed ${rate}x`}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-slate-700 hover:border-indigo-300 hover:text-indigo-700 tabular-nums whitespace-nowrap"
              >
                {rate}x
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
