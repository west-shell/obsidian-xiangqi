import en from './en.json';
import zh from './zh.json';

const messages: Record<string, Record<string, string>> = { en, zh: zh };

let lang = 'zh';
const listeners = new Set<() => void>();

function detect(): string {
  const raw = navigator.language;
  if (messages[raw]) return raw;
  if (raw.toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}

export function t(key: string, _v?: number): string {
  void _v;
  return messages[lang]?.[key] ?? messages.en?.[key] ?? key;
}

export function onLangChange(fn: () => void) {
  listeners.add(fn);
}

export function initI18n(locale: string) {
  if (locale === 'auto') {
    lang = detect();
  } else if (messages[locale]) {
    lang = locale;
  } else if (locale?.toLowerCase().startsWith('zh')) {
    lang = 'zh';
  }
  listeners.forEach(fn => fn());
}
