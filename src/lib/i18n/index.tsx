import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { en, type MessageKey, type Messages } from './messages/en';
import { ar } from './messages/ar';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { de } from './messages/de';
import { pt } from './messages/pt';
import { tr } from './messages/tr';
import { it } from './messages/it';
import { deviceLanguage, isLangCode, languageInfo, type LangCode } from './languages';

export { LANGUAGES, type LangCode } from './languages';
export type { MessageKey } from './messages/en';

const DICTIONARIES: Record<LangCode, Messages> = { en, ar, es, fr, de, pt, tr, it };
const STORAGE_KEY = 'startfit.lang';
/** Flip to true when every screen uses t(): then the whole page follows the language's direction. */
const WHOLE_APP_WRITTEN = false;

/** Fills {name} placeholders. Missing keys fall back to English, never to the raw key. */
export function translate(lang: LangCode, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[lang]?.[key] ?? en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Share of English keys written in a language (1 = complete). */
export function coverage(lang: LangCode): number {
  const keys = Object.keys(en);
  const dict = DICTIONARIES[lang];
  return keys.filter((k) => dict[k as MessageKey]).length / keys.length;
}

function readStored(): LangCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLangCode(v) ? v : null;
  } catch {
    return null;
  }
}

interface I18nValue {
  lang: LangCode;
  dir: 'ltr' | 'rtl';
  /** True once the person has chosen a language (saved on their profile, or on this device when not signed in). */
  chosen: boolean;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLanguage: (code: LangCode) => Promise<void>;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile, session, updateProfile } = useAuth();
  const [lang, setLang] = useState<LangCode>(() => readStored() ?? deviceLanguage());
  const profileLang = profile?.preferred_language;

  // The profile is the source of truth once signed in.
  useEffect(() => {
    if (isLangCode(profileLang) && profileLang !== lang) setLang(profileLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLang]);

  const dir = languageInfo(lang).dir;
  useEffect(() => {
    document.documentElement.lang = lang;
    // Right-to-left is applied per screen (dir={dir}) on screens fully written in the language, so screens
    // still in English do not render mirrored. Switch the whole page once every screen is written.
    document.documentElement.dir = WHOLE_APP_WRITTEN ? dir : 'ltr';
  }, [lang, dir]);

  const setLanguage = useCallback(
    async (code: LangCode) => {
      setLang(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        /* this browser does not keep it */
      }
      if (session) {
        const { error } = await updateProfile({ preferred_language: code });
        if (error) throw new Error(error);
      }
    },
    [session, updateProfile],
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir,
      chosen: session ? isLangCode(profileLang) : readStored() != null,
      t: (key, vars) => translate(lang, key, vars),
      setLanguage,
    }),
    [lang, dir, session, profileLang, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Outside the provider (tests, isolated previews): English, no saving.
  return {
    lang: 'en',
    dir: 'ltr',
    chosen: true,
    t: (key, vars) => translate('en', key, vars),
    setLanguage: async () => undefined,
  };
}
