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
// Palette tuned in OKLCH (perceptual space) with three constraints:
//   1. every mark holds >= 3:1 WCAG contrast against its board background
//      (non-text guideline; verified per theme);
//   2. every role pair stays >= ~0.10 dE-ok apart, so the six roles never
//      collide even where hues are adjacent (teal/green, violet/blue);
//   3. red/green/yellow brushes are lightness-stratified so they survive
//      red-green color-blind viewing, where hue alone would collapse them.
// Roles: selected = teal/cyan frame + dest dots, lastMove = violet trace,
// nextMove = blue preview arrow; brushes: green = engine best, yellow =
// ponder, red = user-drawn.
const selected_light = "#0f766e"; // 深青
const selected_dark = "#22d3ee"; // 亮青（偏蓝，与绿刷子拉开 ΔE 0.09→0.16）
const lastMove_light = "#7c3aed"; // 紫
const lastMove_dark = "#c084fc"; // 亮紫（偏品红，与蓝 nextMove 拉开 ΔE 0.10→0.13）
const nextMove_light = "#1a5fb0"; // 钴蓝
const nextMove_dark = "#6aa7ff"; // 天蓝
// Shape brush colors: engine best-move arrow = green, ponder = yellow;
// user-drawn arrows/circles reuse the same brushes (red/blue via modifier
// keys; blue is already themed as nextMove).
const brushGreen_light = "#2e8b3a";
const brushGreen_dark = "#58d07a";
const brushRed_light = "#b91c1c"; // 加深：与绿刷子明度分层（色弱安全），米色盘 5.0:1
const brushRed_dark = "#ff7676"; // 提亮：绿棋盘上 2.7→3.1:1
// Dark goldenrod instead of bright yellow: on cream/parchment boards a
// light yellow falls under 3:1 contrast (a vivid yellow needs a dark bg).
// Hue stays ~74° (yellow range), well clear of the red brush at ~28°.
const brushYellow_light = "#92620a";
const brushYellow_dark = "#facc15";

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
    selected: "var(--color-green)",
    lastMove: "var(--color-purple)",
    nextMove: "var(--color-blue)",
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
    brushYellow: brushYellow_light,
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
    brushYellow: brushYellow_dark,
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
    // Milky-brown board (lum 0.50): all marks darkened for >= 3.4:1, and
    // the whole set lightness-stratified — the mid-tone background leaves
    // only a narrow L band, so hue spacing must carry role separation
    // (verified: every pair >= 0.11 dE-ok).
    selected: "#164e63",
    lastMove: "#6d28d9",
    nextMove: "#1658a8",
    brushGreen: "#166534",
    brushRed: "#b91c1c",
    brushYellow: "#785008",
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
    // Bright marks for the dark green board; the green/violet/blue trio
    // stays legible over the saturated background and the red/black pieces.
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow_dark,
  },
  wood: {
    name: "Wood",
    nameZh: "木纹",
    bg: "plugins/xiangqi/assets/wood.jpg",
    bgImage: { path: "plugins/xiangqi/assets/wood.jpg", base64: woodB64 },
    grid: "light",
    red: tree_red,
    black: tree_black,
    // Green + violet + blue stay readable over the wood texture via
    // luminance; the cool marks complement the warm grain.
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow_dark,
  },
  bamboo: {
    name: "Bamboo",
    nameZh: "竹韵",
    bg: "plugins/xiangqi/assets/bamboo.jpg",
    bgImage: { path: "plugins/xiangqi/assets/bamboo.jpg", base64: bambooB64 },
    grid: "none",
    red: tree_red,
    black: tree_black,
    // Green + violet + blue stay readable over the bamboo board via
    // luminance; the amber-toned grain frames the cool highlights.
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
    brushGreen: brushGreen_dark,
    brushRed: brushRed_dark,
    brushYellow: brushYellow_dark,
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
