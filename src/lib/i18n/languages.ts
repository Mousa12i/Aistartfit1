// Languages StartFit is written in. Each one is written for its readers (not word-for-word),
// and any text not yet written in a language falls back to English rather than breaking.

export type LangCode = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'tr' | 'it';

export interface LanguageInfo {
  code: LangCode;
  /** The language's name in that language. */
  native: string;
  /** The name in English, for search and support. */
  english: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
  { code: 'ar', native: 'العربية', english: 'Arabic', dir: 'rtl' },
  { code: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'fr', native: 'Français', english: 'French', dir: 'ltr' },
  { code: 'de', native: 'Deutsch', english: 'German', dir: 'ltr' },
  { code: 'pt', native: 'Português', english: 'Portuguese', dir: 'ltr' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish', dir: 'ltr' },
  { code: 'it', native: 'Italiano', english: 'Italian', dir: 'ltr' },
];

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === 'string' && LANGUAGES.some((l) => l.code === v);
}

export function languageInfo(code: LangCode): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Best match for the device language, used only as the pre-selected choice. */
export function deviceLanguage(): LangCode {
  try {
    const list = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
    for (const tag of list) {
      const base = String(tag || '').toLowerCase().split('-')[0];
      if (isLangCode(base)) return base;
    }
  } catch {
    /* no navigator */
  }
  return 'en';
}
