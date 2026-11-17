import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translateUiApi } from '../services/api.ts';
import {
  EN_STRINGS,
  STATIC_UI_DICTIONARIES,
  type UiDictionary,
  type UiKey,
} from '../utils/i18n.ts';
import {
  CUSTOM_LANGUAGE_CODE,
  isRtlLanguage,
  resolveDisplayLanguage,
  resolveLanguageLabel,
} from '../utils/languages.ts';

interface LanguageContextValue {
  languageCode: string;
  customLanguage: string;
  languageName: string; // e.g. "Hindi" or user custom string
  displayLanguage: string; // e.g. "हिन्दी (Hindi)"
  isRtl: boolean;
  translatingUi: boolean;
  setLanguage: (code: string, customName?: string) => void;
  t: (key: UiKey) => string;
}

const STORAGE_CODE_KEY = 'rentalguard_lang_code';
const STORAGE_CUSTOM_KEY = 'rentalguard_lang_custom';
const STORAGE_UI_CACHE_PREFIX = 'rentalguard_ui_dict_v1_';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageCode, setLanguageCode] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_CODE_KEY) || 'en';
    } catch {
      return 'en';
    }
  });

  const [customLanguage, setCustomLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_CUSTOM_KEY) || '';
    } catch {
      return '';
    }
  });

  const [dynamicDicts, setDynamicDicts] = useState<Record<string, Partial<UiDictionary>>>({});
  const [translatingUi, setTranslatingUi] = useState(false);

  const languageName = useMemo(
    () => resolveLanguageLabel(languageCode, customLanguage),
    [languageCode, customLanguage]
  );

  const displayLanguage = useMemo(
    () => resolveDisplayLanguage(languageCode, customLanguage),
    [languageCode, customLanguage]
  );

  const isRtl = useMemo(
    () => isRtlLanguage(languageCode, customLanguage),
    [languageCode, customLanguage]
  );

  const setLanguage = useCallback((code: string, customName?: string) => {
    setLanguageCode(code);
    try {
      localStorage.setItem(STORAGE_CODE_KEY, code);
    } catch {
      // Ignore storage error
    }
    if (customName !== undefined) {
      setCustomLanguage(customName);
      try {
        localStorage.setItem(STORAGE_CUSTOM_KEY, customName);
      } catch {
        // Ignore storage error
      }
    }
  }, []);

  // Load or fetch UI translation dictionary when switching to a language without full static coverage
  useEffect(() => {
    const cacheKey =
      languageCode === CUSTOM_LANGUAGE_CODE
        ? `custom_${languageName.toLowerCase()}`
        : languageCode;

    if (languageCode === 'en') return;

    const staticDict = STATIC_UI_DICTIONARIES[languageCode];
    const hasFullStatic =
      staticDict && Object.keys(staticDict).length >= Object.keys(EN_STRINGS).length - 2;
    if (hasFullStatic) return;

    if (dynamicDicts[cacheKey]) return;

    // Check localStorage cache first
    try {
      const saved = localStorage.getItem(STORAGE_UI_CACHE_PREFIX + cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UiDictionary>;
        setDynamicDicts((prev) => ({ ...prev, [cacheKey]: parsed }));
        return;
      }
    } catch {
      // Ignore invalid cache
    }

    let cancelled = false;
    setTranslatingUi(true);
    translateUiApi(languageName, EN_STRINGS)
      .then((res) => {
        if (cancelled) return;
        const dict = res.translations as Partial<UiDictionary>;
        setDynamicDicts((prev) => ({ ...prev, [cacheKey]: dict }));
        try {
          localStorage.setItem(STORAGE_UI_CACHE_PREFIX + cacheKey, JSON.stringify(dict));
        } catch {
          // Ignore quota issues
        }
      })
      .catch(() => {
        // Gracefully fall back to static/English strings if translation request fails
      })
      .finally(() => {
        if (!cancelled) setTranslatingUi(false);
      });

    return () => {
      cancelled = true;
    };
  }, [languageCode, languageName, dynamicDicts]);

  // Apply dir attribute on root container
  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const t = useCallback(
    (key: UiKey): string => {
      if (languageCode === 'en') return EN_STRINGS[key];
      const cacheKey =
        languageCode === CUSTOM_LANGUAGE_CODE
          ? `custom_${languageName.toLowerCase()}`
          : languageCode;
      return (
        dynamicDicts[cacheKey]?.[key] ||
        STATIC_UI_DICTIONARIES[languageCode]?.[key] ||
        EN_STRINGS[key]
      );
    },
    [languageCode, languageName, dynamicDicts]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      languageCode,
      customLanguage,
      languageName,
      displayLanguage,
      isRtl,
      translatingUi,
      setLanguage,
      t,
    }),
    [
      languageCode,
      customLanguage,
      languageName,
      displayLanguage,
      isRtl,
      translatingUi,
      setLanguage,
      t,
    ]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
