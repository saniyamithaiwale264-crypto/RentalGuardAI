export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  bcp47: string;
  rtl?: boolean;
}

export const CUSTOM_LANGUAGE_CODE = 'custom';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', bcp47: 'en-US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', bcp47: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', bcp47: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', bcp47: 'de-DE' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', bcp47: 'mr-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', bcp47: 'bn-IN' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', bcp47: 'gu-IN' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', bcp47: 'ml-IN' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', bcp47: 'ur-PK', rtl: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', bcp47: 'ar-SA', rtl: true },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', bcp47: 'pt-BR' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', bcp47: 'it-IT' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', bcp47: 'nl-NL' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', bcp47: 'ru-RU' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', bcp47: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', bcp47: 'ko-KR' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', bcp47: 'zh-CN' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', bcp47: 'tr-TR' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', bcp47: 'id-ID' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', bcp47: 'vi-VN' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', bcp47: 'pl-PL' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', bcp47: 'th-TH' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', bcp47: 'sw-KE' },
];

export function resolveLanguageLabel(code: string, customName?: string): string {
  if (code === CUSTOM_LANGUAGE_CODE) {
    const cleaned = (customName || '').trim();
    return cleaned || 'English';
  }
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return found ? found.name : 'English';
}

export function resolveDisplayLanguage(code: string, customName?: string): string {
  if (code === CUSTOM_LANGUAGE_CODE) {
    const cleaned = (customName || '').trim();
    return cleaned || 'Custom Language';
  }
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (!found) return 'English';
  return found.nativeName === found.name
    ? found.name
    : `${found.nativeName} (${found.name})`;
}

export function isRtlLanguage(code: string, customName?: string): boolean {
  if (code === CUSTOM_LANGUAGE_CODE) {
    const lower = (customName || '').toLowerCase();
    return (
      lower.includes('arabic') ||
      lower.includes('urdu') ||
      lower.includes('persian') ||
      lower.includes('farsi') ||
      lower.includes('hebrew') ||
      lower.includes('pashto') ||
      lower.includes('sindhi')
    );
  }
  return Boolean(SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl);
}

export function resolveSpeechLangTag(languageNameOrCode?: string): string {
  if (!languageNameOrCode) return 'en-US';
  const norm = languageNameOrCode.trim().toLowerCase();
  const match = SUPPORTED_LANGUAGES.find(
    (l) =>
      l.code.toLowerCase() === norm ||
      l.name.toLowerCase() === norm ||
      l.nativeName.toLowerCase() === norm ||
      norm.startsWith(l.name.toLowerCase())
  );
  if (match) return match.bcp47;
  if (norm.includes('greek')) return 'el-GR';
  if (norm.includes('nepali')) return 'ne-NP';
  if (norm.includes('ukrain')) return 'uk-UA';
  if (norm.includes('hebrew')) return 'he-IL';
  if (norm.includes('persian') || norm.includes('farsi')) return 'fa-IR';
  if (norm.includes('filipino') || norm.includes('tagalog')) return 'fil-PH';
  if (norm.includes('malay')) return 'ms-MY';
  if (norm.includes('sinhala')) return 'si-LK';
  return 'en-US';
}

