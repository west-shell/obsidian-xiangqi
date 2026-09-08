import { type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";

// Highlight color presets — the suffix names the board it suits:
// *_light for light boards (dark marks), *_dark for dark boards (light marks).
const selected_light = "#14551e";
const selected_dark = "#66bb6a";
const lastMove_light = "#0d47a1";
const lastMove_dark = "#7986cb";
const nextMove_light = "#ef6c00";
const nextMove_dark = "#ffb74d";
// Mid-luminance textured boards (wood ~#8c5531, bamboo ~#366d64): dark marks
// sink into the grain, so highlights must be bright instead.
const selected_warm = "#ffd54f";
const lastMove_wood = "#90caf9";
const nextMove_wood = "#80deea";

interface ThemeDef extends ThemeData {
  red: string;
  black: string;
  /** Highlight colors: a preset constant or a custom value. */
  selected: string;
  lastMove: string;
  nextMove: string;
}

const tree_red = "#861818";
const tree_black = "#0A1C3A";
const themes: Record<string, ThemeDef> = {
  // Auto follows Obsidian's appearance: applyThemes() swaps in the light/dark
  // theme's colors and grid at apply time (re-applied on "css-change"); only
  // bg (Obsidian-native) comes from here. The color fields are
  // type-required placeholders.
  auto: {
    name: "Auto",
    nameZh: "自动",
    bg: "var(--background-primary-alt)",
    grid: "dark",
    red: tree_red,
    black: tree_black,
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
  light: {
    name: "Light",
    nameZh: "亮色",
    bg: "#ebe0d5",
    grid: "dark",
    red: tree_red,
    black: tree_black,
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
  dark: {
    name: "Dark",
    nameZh: "暗色",
    bg: "#2d2d2d",
    grid: "light",
    red: tree_red,
    black: tree_black,
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
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
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
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
    selected: selected_warm,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
  },
  wood: {
    name: "Wood",
    nameZh: "木纹",
    bg: "plugins/xiangqi/assets/wood.jpg",
    bgImage: { path: "plugins/xiangqi/assets/wood.jpg", base64: woodB64 },
    grid: "light",
    red: tree_red,
    black: tree_black,
    selected: selected_warm,
    lastMove: lastMove_wood,
    nextMove: nextMove_wood,
  },
  bamboo: {
    name: "Bamboo",
    nameZh: "竹纹",
    bg: "plugins/xiangqi/assets/bamboo.jpg",
    bgImage: { path: "plugins/xiangqi/assets/bamboo.jpg", base64: bambooB64 },
    grid: "none",
    red: tree_red,
    black: tree_black,
    selected: selected_warm,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
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
  let t = themes[settings.theme] ?? themes.light;
  if (settings.theme === "auto") {
    const base = activeDocument.body.classList.contains("theme-dark")
      ? themes.dark
      : themes.light;
    t = { ...base, bg: themes.auto.bg };
  }
  applyThemeCSSVars(settings, t, app);
  const body = activeDocument.body.style;
  body.setProperty("--xq-piece-red", t.red);
  body.setProperty("--xq-piece-black", t.black);
  // Selected square: corner-bracket frame color (scss/_variant.scss).
  body.setProperty("--xq-bracket-color", t.selected);
  // xiangqiground declares its RGB-triplet marker vars on `.xq-wrap`, which
  // shadows any value inherited from <body>; set plugin-owned hex vars here
  // and override the marker rules in scss/_variant.scss instead.
  // Selection marks (dest dots / capture rings) share the selected color;
  // the next-move preview arrow is a distinct mark with its own color.
  body.setProperty("--xq-lastmove-color", t.lastMove);
  body.setProperty("--xq-dest-color", t.selected);
  body.setProperty("--xq-nextmove-color", t.nextMove);
}
