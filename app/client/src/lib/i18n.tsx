import { createContext, useContext, useState, type ReactNode } from 'react';
import en from '../i18n/en.json';
import fi from '../i18n/fi.json';

/** NFR-MNT-01 — all UI text lives in translation files; add a language by adding a JSON file here. */
export type Lang = 'en' | 'fi';
const DICTS: Record<Lang, Record<string, string>> = { en, fi };
export const LANGS: Lang[] = ['en', 'fi'];

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.en[key];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn('Missing translation', key);
    s = key;
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (k) => translate('en', k) });

function storedLang(): Lang {
  try {
    const l = localStorage.getItem('rb_lang');
    if (l === 'en' || l === 'fi') return l;
  } catch {
    /* ignore */
  }
  return navigator.language?.startsWith('fi') ? 'fi' : 'en';
}

/** Adult UI language provider (remembered per browser). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('rb_lang', l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  };
  document.documentElement.lang = lang;
  return <Ctx.Provider value={{ lang, setLang, t: (k, v) => translate(lang, k, v) }}>{children}</Ctx.Provider>;
}

/** Fixed-language provider: child screens use the child's preferred language. */
export function FixedLang({ lang, children }: { lang: Lang; children: ReactNode }) {
  document.documentElement.lang = lang;
  return <Ctx.Provider value={{ lang, setLang: () => {}, t: (k, v) => translate(lang, k, v) }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
