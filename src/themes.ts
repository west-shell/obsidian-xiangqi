import type { ISettings } from "./types";

interface ThemeDef {
	name: string;
	/** 底层背景色 */
	bg: string;
	/** 纹理叠加，若无则为 "none" */
	texture: string;
	/** 网格线: 'dark' (#555) 或 'light' (#ccc) */
	grid: "dark" | "light";
	/** 红方棋子色 */
	red: string;
	/** 黑方棋子色 */
	black: string;
}

const themes: Record<string, ThemeDef> = {
	wood: {
		name: "木质",
		bg: "#c8963e",
		texture: "repeating-linear-gradient(87deg, rgba(139,90,43,0.25) 0px, rgba(139,90,43,0.25) 1px, transparent 1px, transparent 4px)",
		grid: "dark",
		red: "#b24747",
		black: "#5166b2",
	},
	parchment: {
		name: "羊皮纸",
		bg: "#e8d5a3",
		texture: "radial-gradient(ellipse at 40% 30%, rgba(255,255,240,0.6) 0%, transparent 60%)",
		grid: "dark",
		red: "#b24747",
		black: "#3b4b8c",
	},
	green: {
		name: "绿绒布",
		bg: "#2d5a27",
		texture: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
		grid: "light",
		red: "#d44b4b",
		black: "#8ca3e0",
	},
	marble: {
		name: "石纹",
		bg: "#c8c0b8",
		texture: "radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.5) 0%, transparent 55%)",
		grid: "dark",
		red: "#b24747",
		black: "#3b4b8c",
	},
	light: {
		name: "经典浅色",
		bg: "#e0c88a",
		texture: "none",
		grid: "dark",
		red: "#b24747",
		black: "#5166b2",
	},
	dark: {
		name: "经典深色",
		bg: "#2d2d2d",
		texture: "none",
		grid: "light",
		red: "#861818",
		black: "#2090ff",
	},
};

export const THEME_OPTIONS = Object.fromEntries(
	Object.entries(themes).map(([k, v]) => [k, v.name]),
) as Record<string, string>;

export function applyThemes(settings: ISettings) {
	const { theme, boardMarginTop, boardMarginBottom } = settings;
	const t = themes[theme] ?? themes.light;

	document.body.style.setProperty("--xq-board-bg", t.bg);
	document.body.style.setProperty("--xq-board-texture", t.texture);
	document.body.style.setProperty(
		"--xq-grid",
		t.grid === "dark" ? "var(--xq-grid-dark)" : "var(--xq-grid-light)",
	);
	document.body.style.setProperty("--xq-piece-red", t.red);
	document.body.style.setProperty("--xq-piece-black", t.black);
	document.body.style.setProperty("--board-margin-top", `${boardMarginTop}px`);
	document.body.style.setProperty("--board-margin-bottom", `${boardMarginBottom}px`);
}
