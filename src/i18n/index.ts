import en from './en.json';
import zh_CN from './zh_CN.json';

const messages: Record<string, Record<string, string>> = { en, 'zh-cn': zh_CN };

let lang = 'zh-cn';
const listeners = new Set<() => void>();

function detect(): string {
  const raw = navigator.language;
  if (messages[raw]) return raw;
  if (raw.toLowerCase().startsWith('zh')) return 'zh-cn';
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
    lang = 'zh-cn';
  }
  listeners.forEach(fn => fn());
}
