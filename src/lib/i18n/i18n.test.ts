import { describe, expect, it } from 'vitest';
import { en } from './messages/en';
import { ar } from './messages/ar';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { de } from './messages/de';
import { pt } from './messages/pt';
import { tr } from './messages/tr';
import { it as itMsgs } from './messages/it';
import { translate } from './index';
import { LANGUAGES } from './languages';

const ALL = { ar, es, fr, de, pt, tr, it: itMsgs };
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('languages', () => {
  it('every language writes every English text, with the same placeholders', () => {
    for (const [code, dict] of Object.entries(ALL)) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        const v = dict[key];
        expect(typeof v === 'string' && v.trim().length > 0 ? `${code}:${key}` : `MISSING ${code}:${key}`).toBe(`${code}:${key}`);
        expect(placeholders(v ?? '')).toBe(placeholders(en[key]));
      }
    }
  });
  it('has no keys that English does not have', () => {
    for (const dict of Object.values(ALL)) for (const k of Object.keys(dict)) expect(k in en).toBe(true);
  });
  it('lists only languages with a dictionary, Arabic right-to-left', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'pt', 'tr']);
    expect(LANGUAGES.find((l) => l.code === 'ar')?.dir).toBe('rtl');
  });
  it('falls back to English and fills placeholders', () => {
    expect(translate('ar', 'nav.home')).toBe('الرئيسية');
    expect(translate('de', 'common.save')).toBe('Speichern');
  });
});
