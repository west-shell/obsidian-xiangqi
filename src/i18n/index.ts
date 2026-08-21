import en from "./en.json";
import zh from "./zh.json";

const messages: Record<string, Record<string, string>> = { en, zh };

let lang = "en";
let _sysLang: string | null = null;
let _ver = 0;
const listeners = new Set<() => void>();

function detect(): string {
  const docLang = document.documentElement.lang;
  if (docLang) {
    if (docLang.toLowerCase().startsWith("zh")) return "zh";
    if (messages[docLang]) return docLang;
  }
  const raw = navigator.language;
  if (messages[raw]) return raw;
  if (raw.toLowerCase().startsWith("zh")) return "zh";
  return "en";
}

export function t(key: string, _ver?: number): string {
  void _ver;
  return messages[lang]?.[key] ?? messages.en?.[key] ?? key;
}

export function i18nVer() {
  return _ver;
}

export function onLangChange(fn: () => void) {
  listeners.add(fn);
}

export function getLang(): string {
  return lang;
}

export function initI18n(locale: string) {
  if (locale === "auto") {
    _sysLang ??= detect();
    lang = _sysLang;
  } else {
    lang = resolve(locale);
  }
  _ver++;
  listeners.forEach((fn) => fn());
}

function resolve(raw: string): string {
  if (messages[raw]) return raw;
  if (raw?.toLowerCase().startsWith("zh")) return "zh";
  return "en";
}
