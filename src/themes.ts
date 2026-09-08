import { type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";

// Two default highlight sets — deep marks for light boards, bright marks
// for dark boards. Themes pick from these per field; textured boards
// (parchment/wood/bamboo/green) override individual fields with custom
// values tuned to their background.
//
// Every set runs on the same triad, so the three roles are always
// distinguishable from each other AND from the red/black pieces no matter
// which board they sit on:
//   selected = teal (cool "active" frame + destination dots)
//   lastMove = cobalt/sky blue (cool trace of the previous move)
//   nextMove = orange-red (preview arrow — a warm accent clearly apart
//              from the two cool highlights)
const selected_light = "#0f766e"; // 青绿
const selected_dark = "#1517c0"; // 亮青绿
const lastMove_light = "#1a5fb0"; // 钴蓝
const lastMove_dark = "#6aa7ff"; // 天蓝
const nextMove_light = "#e8590c"; // 橙红
const nextMove_dark = "#ff8a3d"; // 亮橙
// Shape brush colors: engine best-move arrow = green, ponder = yellow;
// user-drawn arrows/circles reuse the same brushes (red/blue via modifier
// keys; blue is already themed as nextMove).
const brushGreen_light = "#2e8b3a";
const brushGreen_dark = "#58d07a";
const brushRed_light = "#d64541";
const brushRed_dark = "#ff5b5b";
// Orange — same warning family as the nextMove accent, so a ponder arrow
// stays warm but never reads as a teal selection mark.
const brushYellow = "#f57c00";

interface ThemeDef extends ThemeData {
  red: string;
  black: string;
  /** Highlight colors: selection marks / last move / next-move arrow. */
  selected: string;
  lastMove: string;
  nextMove: string;
  /** Shape brushes: engine best move / user red / engine ponder. */
  brushGreen: string;
  brushRed: string;
  brushYellow: string;
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
    selected: "var(--color-blue)",
    lastMove: "var(--color-cyan)",
    nextMove: "var(--color-purple)",
    brushGreen: "var(--color-green)",
    brushRed: "var(--color-red)",
    brushYellow: "var(--color-yellow)",
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
    brushGreen: brushGreen_light,
    brushRed: brushRed_light,
    brushYellow: brushYellow,
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
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow,
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
    // Milky-brown board: deep teal pairs with the warm background as its
    // complement; the navy lastMove and burnt-orange nextMove keep the
    // triad sharply distinguishable.
    selected: "#0e7490",
    lastMove: "#1658a8",
    nextMove: "#d9480b",
    brushGreen: "#2f7d32",
    brushRed: "#c0392b",
    brushYellow: brushYellow,
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
    // Bright marks for the dark green board; orange nextMove separates
    // from the sky-blue lastMove and stays clear of the red/black pieces.
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow,
  },
  wood: {
    name: "Wood",
    nameZh: "木纹",
    bg: "plugins/xiangqi/assets/wood.jpg",
    bgImage: { path: "plugins/xiangqi/assets/wood.jpg", base64: woodB64 },
    grid: "light",
    red: tree_red,
    black: tree_black,
    // Teal + sky-blue + orange stay readable over the wood texture via
    // luminance; the cool teal complements the warm grain.
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow,
  },
  bamboo: {
    name: "Bamboo",
    nameZh: "竹纹",
    bg: "plugins/xiangqi/assets/bamboo.jpg",
    bgImage: { path: "plugins/xiangqi/assets/bamboo.jpg", base64: bambooB64 },
    grid: "none",
    red: tree_red,
    black: tree_black,
    // Teal + sky-blue + orange stay readable over the teal board via
    // luminance; the amber-toned wood grain frames the cool highlights.
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow,
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
  // Shape brush colors (engine arrows + user-drawn shapes).
  body.setProperty("--xq-brush-green", t.brushGreen);
  body.setProperty("--xq-brush-red", t.brushRed);
  body.setProperty("--xq-brush-yellow", t.brushYellow);
}
