import { addIcon, type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";

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
