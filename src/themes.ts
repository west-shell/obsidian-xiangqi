import { type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";

interface ThemeDef extends ThemeData {
  red: string;
  black: string;
}

const tree_red = "#861818";
const tree_black = "#0A1C3A";
const themes: Record<string, ThemeDef> = {
  auto: {
    name: "Auto",
    nameZh: "自动",
    bg: "var(--background-primary-alt)",
    grid: "dark",
    red: "var(--xq-auto-red)",
    black: "var(--xq-auto-black)",
  },
  light: {
    name: "Light",
    nameZh: "亮色",
    bg: "#ebe0d5",
    grid: "dark",
    red: tree_red,
    black: tree_black,
  },
  dark: {
    name: "Dark",
    nameZh: "暗色",
    bg: "#2d2d2d",
    grid: "light",
    red: tree_red,
    black: tree_black,
  },
  parchment: {
    name: "Parchment",
    nameZh: "羊皮纸",
    bg: "#d0b899",
    texture:
      "radial-gradient(ellipse at 40% 30%, rgba(180,170,150,0.3) 0%, transparent 70%)",
    grid: "dark",
    red: tree_red,
    black: tree_black,
  },
  green: {
    name: "Green",
    nameZh: "绿色",
    bg: "#2d5a27",
    texture:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
    grid: "light",
    red: tree_red,
    black: tree_black,
  },
  wood: {
    name: "Wood",
    nameZh: "木纹",
    bg: "plugins/xiangqi/assets/wood.jpg",
    bgImage: { path: "plugins/xiangqi/assets/wood.jpg", base64: woodB64 },
    grid: "light",
    red: tree_red,
    black: tree_black,
  },
  bamboo: {
    name: "Bamboo",
    nameZh: "竹纹",
    bg: "plugins/xiangqi/assets/bamboo.jpg",
    bgImage: { path: "plugins/xiangqi/assets/bamboo.jpg", base64: bambooB64 },
    grid: "none",
    red: tree_red,
    black: tree_black,
  },
};

export type ThemeName = keyof typeof themes;
export const THEME_KEYS = Object.keys(themes);

export function getThemeDisplayName(key: string, lang: string): string {
  const def = themes[key];
  if (!def) return key;
  return lang === "zh" ? def.nameZh : def.name;
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function ensureDir(
  adapter: {
    exists(p: string): Promise<boolean>;
    mkdir(p: string): Promise<void>;
  },
  dir: string,
) {
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (!(await adapter.exists(cur))) {
      await adapter.mkdir(cur);
    }
  }
}

export async function ensureBoardAssets(app: App): Promise<void> {
  const adapter = app.vault.adapter;
  const configDir = app.vault.configDir;
  for (const def of Object.values(themes)) {
    const img = def.bgImage;
    if (!img) continue;
    const fullPath = `${configDir}/${img.path}`;
    try {
      if (await adapter.exists(fullPath)) continue;
      const slash = img.path.lastIndexOf("/");
      if (slash > 0) {
        await ensureDir(adapter, `${configDir}/${img.path.slice(0, slash)}`);
      }
      await adapter.writeBinary(fullPath, base64ToArrayBuffer(img.base64));
    } catch (err) {
      console.error(`[xiangqi] 写入背景图失败: ${img.path}`, err);
    }
  }
}

export function applyThemes(settings: ISettings, app?: App) {
  const t = themes[settings.theme] ?? themes.light;
  applyThemeCSSVars(settings, t, app);
  const body = activeDocument.body.style;
  body.setProperty("--chess-piece-red", t.red);
  body.setProperty("--chess-piece-black", t.black);
}
