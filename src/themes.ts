import { addIcon, type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";

export const GRID_SVG = `<svg class="xq-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 500" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none"><rect x="20" y="20" width="410" height="460" fill="none" stroke="var(--xq-grid-color,#555)" stroke-width="3"/><rect x="25" y="25" width="400" height="450" fill="none" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="25" x2="425" y2="25" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="75" x2="425" y2="75" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="125" x2="425" y2="125" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="175" x2="425" y2="175" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="225" x2="425" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="275" x2="425" y2="275" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="325" x2="425" y2="325" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="375" x2="425" y2="375" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="425" x2="425" y2="425" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="475" x2="425" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="25" x2="25" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="75" y1="25" x2="75" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="125" y1="25" x2="125" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="175" y1="25" x2="175" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="225" y1="25" x2="225" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="275" y1="25" x2="275" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="325" y1="25" x2="325" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="375" y1="25" x2="375" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="425" y1="25" x2="425" y2="225" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="25" y1="275" x2="25" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="75" y1="275" x2="75" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="125" y1="275" x2="125" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="175" y1="275" x2="175" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="225" y1="275" x2="225" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="275" y1="275" x2="275" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="325" y1="275" x2="325" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="375" y1="275" x2="375" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="425" y1="275" x2="425" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="175" y1="25" x2="275" y2="125" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="275" y1="25" x2="175" y2="125" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="175" y1="375" x2="275" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><line x1="275" y1="375" x2="175" y2="475" stroke="var(--xq-grid-color,#555)" stroke-width="1"/><text x="100" y="250" font-size="30" fill="var(--xq-grid-color,#555)" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">楚 河</text><text x="350" y="250" font-size="30" fill="var(--xq-grid-color,#555)" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">漢 界</text><path d="M 71,113.5 v 7.5 h -7.5 M 79,113.5 v 7.5 h 7.5 M 79,136.5 v -7.5 h 7.5 M 71,136.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 371,113.5 v 7.5 h -7.5 M 379,113.5 v 7.5 h 7.5 M 379,136.5 v -7.5 h 7.5 M 371,136.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 71,363.5 v 7.5 h -7.5 M 79,363.5 v 7.5 h 7.5 M 79,386.5 v -7.5 h 7.5 M 71,386.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 371,363.5 v 7.5 h -7.5 M 379,363.5 v 7.5 h 7.5 M 379,386.5 v -7.5 h 7.5 M 371,386.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 121,163.5 v 7.5 h -7.5 M 129,163.5 v 7.5 h 7.5 M 129,186.5 v -7.5 h 7.5 M 121,186.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 221,163.5 v 7.5 h -7.5 M 229,163.5 v 7.5 h 7.5 M 229,186.5 v -7.5 h 7.5 M 221,186.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 321,163.5 v 7.5 h -7.5 M 329,163.5 v 7.5 h 7.5 M 329,186.5 v -7.5 h 7.5 M 321,186.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 121,313.5 v 7.5 h -7.5 M 129,313.5 v 7.5 h 7.5 M 129,336.5 v -7.5 h 7.5 M 121,336.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 221,313.5 v 7.5 h -7.5 M 229,313.5 v 7.5 h 7.5 M 229,336.5 v -7.5 h 7.5 M 221,336.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 321,313.5 v 7.5 h -7.5 M 329,313.5 v 7.5 h 7.5 M 329,336.5 v -7.5 h 7.5 M 321,336.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 29,163.5 v 7.5 h 7.5 M 29,186.5 v -7.5 h 7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 29,313.5 v 7.5 h 7.5 M 29,336.5 v -7.5 h 7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 421,163.5 v 7.5 h -7.5 M 421,186.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 421,313.5 v 7.5 h -7.5 M 421,336.5 v -7.5 h -7.5" stroke="var(--xq-grid-color,#555)" stroke-width="1" fill="none"/></svg>`;

/** 棋盘背景图片：路径相对 vault configDir（.obsidian），base64 为内嵌兜底数据 */
interface BgImage {
  /** 相对 .obsidian 的路径，例如 plugins/xiangqi/assets/wood.jpg */
  path: string;
  /** 构建期内嵌的 base64（无 data: 前缀），缺失时用于写盘还原 */
  base64: string;
}

interface ThemeDef {
  /** 底层背景：CSS颜色值 或 图片路径（相对 .obsidian configDir） */
  bg: string;
  /** 图片型背景的兜底数据；非图片背景留空 */
  bgImage?: BgImage;
  /** 纹理叠加，若无则为 "none" */
  texture: string;
  /** 网格线: 'dark' | 'light' | 'none'（图片背景可关闭网格） */
  grid: "dark" | "light" | "none";
  /** 红方棋子色 */
  red: string;
  /** 黑方棋子色 */
  black: string;
}
const tree_red = "#861818";
const tree_black = "#0A1C3A";
const themes: Record<string, ThemeDef> = {
  auto: {
    bg: "var(--background-primary-alt)",
    texture: "none",
    grid: "dark",
    red: "var(--xq-auto-red)",
    black: "var(--xq-auto-black)",
  },
  light: {
    bg: "#ebe0d5",
    texture: "none",
    grid: "dark",
    red: tree_red,
    black: tree_black,
  },
  dark: {
    bg: "#2d2d2d",
    texture: "none",
    grid: "light",
    red: tree_red,
    black: tree_black,
  },
  parchment: {
    bg: "#d0b899b4",
    texture:
      "radial-gradient(ellipse at 40% 30%, rgba(180,170,150,0.3) 0%, transparent 70%)",
    grid: "dark",
    red: tree_red,
    black: tree_black,
  },
  green: {
    bg: "#2d5a27",
    texture:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
    grid: "light",
    red: tree_red,
    black: tree_black,
  },
  wood: {
    bg: "plugins/xiangqi/assets/wood.jpg",
    bgImage: { path: "plugins/xiangqi/assets/wood.jpg", base64: woodB64 },
    texture: "none",
    grid: "light",
    red: tree_red,
    black: tree_black,
  },
  bamboo: {
    bg: "plugins/xiangqi/assets/bamboo.jpg",
    bgImage: { path: "plugins/xiangqi/assets/bamboo.jpg", base64: bambooB64 },
    texture: "none",
    grid: "none",
    red: tree_red,
    black: tree_black,
  },
};

export type ThemeName = keyof typeof themes;
export const THEME_KEYS = Object.keys(themes);

function isImagePath(s: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(s);
}

/** base64 字符串 -> ArrayBuffer（writeBinary 需要） */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** 确保指定目录路径存在（含中间目录），configDir 之外的祖先目录假定已存在 */
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

/**
 * 检查所有图片型主题背景是否已在本地存在；缺失则用内嵌 base64 解码写盘。
 * 幂等：已存在的文件不重写。写盘失败仅记录日志，不影响其它主题。
 */
export async function ensureBoardAssets(app: App): Promise<void> {
  const adapter = app.vault.adapter;
  const configDir = app.vault.configDir;
  for (const def of Object.values(themes)) {
    const img = def.bgImage;
    if (!img) continue;
    const fullPath = `${configDir}/${img.path}`;
    try {
      if (await adapter.exists(fullPath)) continue;
      // writeBinary 不会自动创建中间目录，需先确保 assets/ 目录存在
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

export function registerIcon() {
  addIcon(
    "xiangqi-icon",
    `
<svg viewBox="0 0 80 80">
  <circle cx="40" cy="40" r="38"
    fill="var(--background-primary-alt)"
    stroke="var(--text-normal)"
    stroke-width="4" />
  <text x="50%" y="58%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="60"
    fill="var(--text-normal)"
    font-weight="bold">象</text>
</svg>
`,
  );
}

export function applyThemes(app: App, settings: ISettings) {
  const {
    theme,
    cellSize,
    boardMarginTop,
    boardMarginBottom,
    showCoordinateLabels,
  } = settings;
  const t = themes[theme] ?? themes.light;

  const bg = isImagePath(t.bg)
    ? `url('${app.vault.adapter.getResourcePath(app.vault.configDir + "/" + t.bg)}') center / cover no-repeat`
    : t.bg;

  activeDocument.body.style.setProperty("--xq-cell-size", `${cellSize}px`);
  activeDocument.body.style.setProperty(
    "--xq-font-size",
    `${settings.fontSize}px`,
  );
  activeDocument.body.style.setProperty("--xq-board-bg", bg);
  activeDocument.body.style.setProperty("--xq-board-texture", t.texture);
  activeDocument.body.style.setProperty(
    "--xq-grid-color",
    t.grid === "dark" ? "#555" : t.grid === "light" ? "#ccc" : "transparent",
  );
  activeDocument.body.style.setProperty(
    "--xq-coords-display",
    showCoordinateLabels ? "flex" : "none",
  );
  activeDocument.body.style.setProperty("--xq-piece-red", t.red);
  activeDocument.body.style.setProperty("--xq-piece-black", t.black);
  activeDocument.body.style.setProperty(
    "--xq-board-margin-top",
    `${boardMarginTop}px`,
  );
  activeDocument.body.style.setProperty(
    "--xq-board-margin-bottom",
    `${boardMarginBottom}px`,
  );
}
