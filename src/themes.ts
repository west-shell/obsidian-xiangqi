import { type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";
import { hexToRgbTriplet } from "./utils/utils";

// Highlight color presets — the suffix names the board it suits:
// *_light for light boards (dark marks), *_dark for dark boards (light marks).
const selected_light = "#14551e";
const selected_dark = "#66bb6a";
const lastMove_light = "#0d47a1";
const lastMove_dark = "#7986cb";
const nextMove_light = "#14551e";
const nextMove_dark = "#66bb6a";

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
  // Auto follows Obsidian's appearance: the --ct-auto-* vars are defined per
  // body.theme-light / body.theme-dark in scss/_variant.scss.
  auto: {
    name: "Auto",
    nameZh: "自动",
    bg: "var(--background-primary-alt)",
    grid: "dark",
    red: "var(--xq-auto-red)",
    black: "var(--xq-auto-black)",
    selected: "var(--ct-auto-selected)",
    lastMove: "var(--ct-auto-lastmove)",
    nextMove: "var(--ct-auto-nextmove)",
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
    selected: "#ffd54f",
    lastMove: lastMove_dark,
    nextMove: "#ffd54f",
  },
  wood: {
    name: "Wood",
    nameZh: "木纹",
    bg: "plugins/xiangqi/assets/wood.jpg",
    bgImage: { path: "plugins/xiangqi/assets/wood.jpg", base64: woodB64 },
    grid: "light",
    red: tree_red,
    black: tree_black,
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
  bamboo: {
    name: "Bamboo",
    nameZh: "竹纹",
    bg: "plugins/xiangqi/assets/bamboo.jpg",
    bgImage: { path: "plugins/xiangqi/assets/bamboo.jpg", base64: bambooB64 },
    grid: "none",
    red: tree_red,
    black: tree_black,
    selected: "#ffd54f",
    lastMove: lastMove_light,
    nextMove: "#ffd54f",
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
  body.setProperty("--ct-piece-primary", t.red);
  body.setProperty("--ct-piece-secondary", t.black);
  body.setProperty("--ct-selected-color", t.selected);
  body.setProperty("--ct-lastmove-color", t.lastMove);
  body.setProperty("--ct-nextmove-color", t.nextMove);
  // xiangqiground consumes RGB-triplet vars for its built-in markers
  // (last-move block/bracket, move-dest dots). Non-hex values (e.g. the
  // auto theme's var() indirection) pass through unchanged.
  body.setProperty("--xq-last-move-orig-color", hexToRgbTriplet(t.lastMove));
  body.setProperty("--xq-move-dest-color", hexToRgbTriplet(t.nextMove));
}
