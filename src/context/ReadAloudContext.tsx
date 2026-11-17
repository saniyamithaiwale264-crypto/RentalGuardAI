import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { synthesizeSpeechApi } from '../services/api.ts';
import { resolveSpeechLangTag } from '../utils/languages.ts';
import { normalizeSpeechPronunciation } from '../utils/speechText.ts';

export type ReadAloudEngine = 'browser' | 'ai';
export type ReadAloudStatus = 'idle' | 'loading' | 'playing' | 'paused';
export type AiVoiceName = 'Kore' | 'Zephyr' | 'Charon' | 'Puck';

export interface SpeakPayload {
  id: string;
  title: string;
  text: string;
  languageName?: string;
}

interface ReadAloudContextValue {
  status: ReadAloudStatus;
  activeItemId: string | null;
  activeTitle: string;
  engine: ReadAloudEngine;
  voiceName: AiVoiceName;
  rate: number;
  errorMessage: string | null;
  speak: (
    payload: SpeakPayload,
    overrideEngine?: ReadAloudEngine,
    overrideVoice?: AiVoiceName
  ) => Promise<void>;
  toggleSpeak: (payload: SpeakPayload) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  switchEngine: (engine: ReadAloudEngine) => Promise<void>;
  switchVoice: (voiceName: AiVoiceName) => Promise<void>;
  dismissError: () => void;
}

const VOICE_STORAGE_KEY = 'rentalguard_tts_voice';

const ReadAloudContext = createContext<ReadAloudContextValue | null>(null);

function splitIntoSpeechChunks(raw: string, maxLen = 170): string[] {
  const cleaned = normalizeSpeechPronunciation(raw);
  if (!cleaned) return [];

  const sentences = cleaned
    .split(/(?<=[.!?।。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = sentence.split(/\s+/);
      let part = '';
      for (const word of words) {
        if ((part + ' ' + word).trim().length > maxLen && part) {
          chunks.push(part);
          part = word;
        } else {
          part = (part ? part + ' ' : '') + word;
        }
      }
      if (part) chunks.push(part);
      continue;
    }

    if ((current + ' ' + sentence).trim().length > maxLen && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = (current ? current + ' ' : '') + sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [cleaned];
}

function scoreBrowserVoice(voice: SpeechSynthesisVoice, bcp47: string): number {
  const lower = bcp47.toLowerCase();
  const baseLang = lower.split('-')[0];
  const vLang = voice.lang.toLowerCase();

  let score = 0;
  if (vLang === lower) score += 100;
  else if (vLang.startsWith(baseLang + '-')) score += 70;
  else if (vLang === baseLang) score += 50;
  else return -1;

  const name = voice.name.toLowerCase();
  // Prefer crisp neural/natural/enhanced voices over legacy local synthesizers
  if (name.includes('natural')) score += 40;
  if (name.includes('neural')) score += 40;
  if (name.includes('google')) score += 30;
  if (name.includes('online')) score += 25;
  if (name.includes('enhanced') || name.includes('premium')) score += 25;
  if (name.includes('samantha') || name.includes('daniel') || name.includes('serena')) score += 20;
  if (voice.localService === false) score += 10;
  return score;
}

function findBestBrowserVoice(
  voices: SpeechSynthesisVoice[],
  bcp47: string
): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const voice of voices) {
    const s = scoreBrowserVoice(voice, bcp47);
    if (s > bestScore) {
      bestScore = s;
      best = voice;
    }
  }
  return best;
}

export function ReadAloudProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ReadAloudStatus>('idle');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  // Default to crisp neural AI Voice for clear pronunciation across all languages
  const [engine, setEngine] = useState<ReadAloudEngine>('ai');
  const [voiceName, setVoiceName] = useState<AiVoiceName>(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      if (saved === 'Kore' || saved === 'Zephyr' || saved === 'Charon' || saved === 'Puck') {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return 'Kore';
  });
  const [rate, setRateState] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const lastPayloadRef = useRef<SpeakPayload | null>(null);
  const rateRef = useRef(1);
  rateRef.current = rate;

  const stopInternal = useCallback((clearLast = true) => {
    sessionRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech cancel error
      }
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      } catch {
        // Ignore audio cleanup error
      }
      audioRef.current = null;
    }
    setStatus('idle');
    setActiveItemId(null);
    setActiveTitle('');
    if (clearLast) {
      lastPayloadRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopInternal(true);
    };
  }, [stopInternal]);

  const playWithAiVoice = useCallback(
    async (payload: SpeakPayload, sessionId: number, selectedVoice: AiVoiceName) => {
      const lang = (payload.languageName || 'English').trim() || 'English';
      const normalized = normalizeSpeechPronunciation(payload.text);
      const cacheKey = `${lang.toLowerCase()}::${selectedVoice}::${normalized.slice(0, 2200)}`;
      let audioSrc = ttsCacheRef.current.get(cacheKey);

      if (!audioSrc) {
        setStatus('loading');
        const res = await synthesizeSpeechApi({
          text: normalized,
          language: lang,
          voiceName: selectedVoice,
        });
        if (sessionRef.current !== sessionId) return;
        audioSrc = `data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`;
        ttsCacheRef.current.set(cacheKey, audioSrc);
      }

      if (sessionRef.current !== sessionId) return;

      const audio = new Audio(audioSrc);
      audio.playbackRate = rateRef.current;
      audioRef.current = audio;

      audio.onended = () => {
        if (sessionRef.current === sessionId) {
          stopInternal(false);
        }
      };

      audio.onerror = () => {
        if (sessionRef.current === sessionId) {
          setErrorMessage('Unable to play generated audio in this browser.');
          stopInternal(false);
        }
      };

      await audio.play();
      if (sessionRef.current === sessionId) {
        setStatus('playing');
      }
    },
    [stopInternal]
  );

  const playWithBrowserSpeech = useCallback(
    (payload: SpeakPayload, sessionId: number): boolean => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return false;
      }

      const bcp47 = resolveSpeechLangTag(payload.languageName);
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = findBestBrowserVoice(voices, bcp47);

      const baseLang = bcp47.split('-')[0].toLowerCase();
      if (voices.length > 0 && baseLang !== 'en' && !matchedVoice) {
        return false;
      }

      const chunks = splitIntoSpeechChunks(payload.text);
      if (chunks.length === 0) return false;

      let idx = 0;
      setStatus('playing');

      const speakNext = () => {
        if (sessionRef.current !== sessionId) return;
        if (idx >= chunks.length) {
          stopInternal(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[idx]);
        utterance.lang = bcp47;
        utterance.rate = rateRef.current;
        utterance.pitch = 1.0;
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.onend = () => {
          if (sessionRef.current !== sessionId) return;
          idx += 1;
          speakNext();
        };

        utterance.onerror = (ev) => {
          if (sessionRef.current !== sessionId) return;
          if (ev.error === 'interrupted' || ev.error === 'canceled') return;
          setErrorMessage('Browser speech playback failed. Try switching to AI Voice.');
          stopInternal(false);
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
      return true;
    },
    [stopInternal]
  );

  const speak = useCallback(
    async (
      payload: SpeakPayload,
      overrideEngine?: ReadAloudEngine,
      overrideVoice?: AiVoiceName
    ) => {
      const cleanText = normalizeSpeechPronunciation(payload.text || '');
      if (!cleanText) return;

      stopInternal(false);
      const sessionId = sessionRef.current;
      const targetPayload: SpeakPayload = { ...payload, text: cleanText };
      lastPayloadRef.current = targetPayload;

      setErrorMessage(null);
      setActiveItemId(payload.id);
      setActiveTitle(payload.title);

      const chosenEngine = overrideEngine || engine;
      const chosenVoice = overrideVoice || voiceName;
      if (overrideEngine) {
        setEngine(overrideEngine);
      }

      if (chosenEngine === 'browser') {
        const started = playWithBrowserSpeech(targetPayload, sessionId);
        if (started) {
          return;
        }
        setEngine('ai');
      }

      try {
        await playWithAiVoice(targetPayload, sessionId, chosenVoice);
      } catch (err) {
        // Fallback cleanly to Browser Voice if AI TTS fails
        const fallbackStarted =
          !overrideEngine && playWithBrowserSpeech(targetPayload, sessionId);
        if (fallbackStarted) {
          setEngine('browser');
          return;
        }
        if (sessionRef.current === sessionId) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to generate Read Aloud audio.'
          );
          stopInternal(false);
        }
      }
    },
    [engine, voiceName, playWithAiVoice, playWithBrowserSpeech, stopInternal]
  );

  const toggleSpeak = useCallback(
    async (payload: SpeakPayload) => {
      if (activeItemId === payload.id && status !== 'idle') {
        stopInternal(true);
        return;
      }
      await speak(payload);
    },
    [activeItemId, speak, status, stopInternal]
  );

  const pause = useCallback(() => {
    if (status !== 'playing') return;
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus('paused');
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setStatus('paused');
    }
  }, [status]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    if (audioRef.current) {
      void audioRef.current.play();
      setStatus('playing');
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setStatus('playing');
    }
  }, [status]);

  const stop = useCallback(() => {
    setErrorMessage(null);
    stopInternal(true);
  }, [stopInternal]);

  const setRate = useCallback((nextRate: number) => {
    setRateState(nextRate);
    rateRef.current = nextRate;
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  }, []);

  const switchEngine = useCallback(
    async (nextEngine: ReadAloudEngine) => {
      setEngine(nextEngine);
      if (lastPayloadRef.current && status !== 'idle') {
        await speak(lastPayloadRef.current, nextEngine);
      }
    },
    [speak, status]
  );

  const switchVoice = useCallback(
    async (nextVoice: AiVoiceName) => {
      setVoiceName(nextVoice);
      try {
        localStorage.setItem(VOICE_STORAGE_KEY, nextVoice);
      } catch {
        // Ignore storage error
      }
      if (lastPayloadRef.current && status !== 'idle' && engine === 'ai') {
        await speak(lastPayloadRef.current, 'ai', nextVoice);
      }
    },
    [engine, speak, status]
  );

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const value = useMemo<ReadAloudContextValue>(
    () => ({
      status,
      activeItemId,
      activeTitle,
      engine,
      voiceName,
      rate,
      errorMessage,
      speak,
      toggleSpeak,
      pause,
      resume,
      stop,
      setRate,
      switchEngine,
      switchVoice,
      dismissError,
    }),
    [
      status,
      activeItemId,
      activeTitle,
      engine,
      voiceName,
      rate,
      errorMessage,
      speak,
      toggleSpeak,
      pause,
      resume,
      stop,
      setRate,
      switchEngine,
      switchVoice,
      dismissError,
    ]
  );

  return <ReadAloudContext.Provider value={value}>{children}</ReadAloudContext.Provider>;
}

export function useReadAloud(): ReadAloudContextValue {
  const ctx = useContext(ReadAloudContext);
  if (!ctx) {
    throw new Error('useReadAloud must be used within a ReadAloudProvider');
  }
  return ctx;
}
