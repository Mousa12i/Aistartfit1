// The language each coach answers in: the one the person chose in the app (profiles.preferred_language).

const NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic (Modern Standard Arabic, warm and simple; numbers may stay in Western digits)',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  tr: 'Turkish',
  it: 'Italian',
};

/** One line added to every coach's system prompt. */
export function languageInstruction(code: unknown): string {
  const name = typeof code === 'string' && NAMES[code] ? NAMES[code] : null;
  if (!name) return 'LANGUAGE: Reply in the language the person writes in.';
  return `LANGUAGE: The person chose ${name} for the app. Write every reply (and every text field of any JSON you return) in ${name}, written naturally for native readers, not translated word for word. If they write to you in a different language, answer in that language instead. Keep exercise names that are usually said in English (e.g. "Bench Press") understandable, adding the local name when one is common.`;
}
