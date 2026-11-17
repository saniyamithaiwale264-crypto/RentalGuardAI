import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import {
  CUSTOM_LANGUAGE_CODE,
  SUPPORTED_LANGUAGES,
} from '../utils/languages.ts';
import { useLanguage } from '../context/LanguageContext.tsx';

interface LanguageSelectorProps {
  compact?: boolean;
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { languageCode, customLanguage, translatingUi, setLanguage, t } = useLanguage();
  const [draftCustom, setDraftCustom] = useState(customLanguage);

  function handleSelectChange(val: string) {
    if (val === CUSTOM_LANGUAGE_CODE) {
      setLanguage(CUSTOM_LANGUAGE_CODE, draftCustom || customLanguage || '');
    } else {
      setLanguage(val);
    }
  }

  function handleApplyCustom(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = draftCustom.trim();
    if (!cleaned) return;
    setLanguage(CUSTOM_LANGUAGE_CODE, cleaned);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <label htmlFor="global-language-select" className="flex items-center gap-1.5 font-medium">
          <Globe className="h-3.5 w-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
          <span>{t('languageLabel')}</span>
        </label>
        {translatingUi && (
          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {!compact && <span>{t('translatingInterface')}</span>}
          </span>
        )}
      </div>

      <select
        id="global-language-select"
        value={languageCode}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
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

      {languageCode === CUSTOM_LANGUAGE_CODE && (
        <form onSubmit={handleApplyCustom} className="flex items-center gap-1.5">
          <input
            type="text"
            value={draftCustom}
            onChange={(e) => setDraftCustom(e.target.value)}
            placeholder={t('customLanguagePlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draftCustom.trim()}
            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {t('applyLanguage')}
          </button>
        </form>
      )}
    </div>
  );
}
