import { addIcon, type App } from "obsidian";

import bambooB64 from "../assets/bamboo.jpg?base64";
import woodB64 from "../assets/wood.jpg?base64";

import type { ISettings } from "./types";
import { applyThemeCSSVars, registerCustomIcon, type ThemeData } from "./chess";

interface BgImage {
  path: string;
  base64: string;
}

interface ThemeDef extends ThemeData {
  bgImage?: BgImage;
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

export function registerIcon() {
  registerCustomIcon(addIcon);
}

export function applyThemes(settings: ISettings) {
  const t = themes[settings.theme] ?? themes.light;
  applyThemeCSSVars(settings, t);
}
