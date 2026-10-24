import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";
import fr from "./fr.json";
import ja from "./ja.json";
import ko from "./ko.json";
import ru from "./ru.json";
import zh from "./zh.json";

const messages: Record<string, Record<string, string>> = {
  en,
  zh,
  ja,
  ko,
  ru,
  de,
  fr,
  ar,
};

let lang = "en";
let _sysLang: string | null = null;
let _ver = 0;
const listeners = new Set<() => void>();

/** Map a raw locale string (e.g. "ja-JP", "zh_TW") to a supported language key. */
function match(raw: string): string | null {
  if (!raw) return null;
  if (raw.toLowerCase().startsWith("zh")) return "zh";
  if (messages[raw]) return raw;
  const base = raw.toLowerCase().split(/[-_]/)[0];
  return Object.keys(messages).find((k) => k.toLowerCase() === base) ?? null;
}

function detect(): string {
  const docLang = document.documentElement.lang;
  return match(docLang) ?? match(navigator.language) ?? "en";
}

export function t(key: string, _ver?: number): string {
  void _ver;
  return messages[lang]?.[key] ?? messages.en?.[key] ?? key;
}

export function i18nVer() {
  return _ver;
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
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
  return match(raw) ?? "en";
}
