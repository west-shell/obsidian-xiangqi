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
const tree_red = '#861818';
const tree_black = '#000080';

const themes: Record<string, ThemeDef> = {
	wood: {
		name: "木质",
		bg: "#CBA35C",
		texture: "repeating-linear-gradient(87deg, rgba(139,90,43,0.25) 0px, rgba(139,90,43,0.25) 2px, transparent 2px, transparent 6px)",
		grid: "dark",
		// red: "#b24747",
		// black: "#5166b2",
		red: tree_red,
		black: tree_black,
	},
	parchment: {
		name: "羊皮纸",
		bg: "#d0b899b4",
		texture: "radial-gradient(ellipse at 40% 30%, rgba(180,170,150,0.3) 0%, transparent 70%)",
		grid: "dark",
		// red: "#b24747",
		// black: "#3b4b8c",
		red: tree_red,
		black: tree_black,
	},
	green: {
		name: "绿绒布",
		bg: "#2d5a27",
		texture: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
		grid: "light",
		// red: "#d44b4b",
		// black: "#8ca3e0",
		red: tree_red,
		black: tree_black,
	},
	light: {
		name: "经典浅色",
		bg: "#c8c0b8",
		texture: "none",
		grid: "dark",
		// red: "#b24747",
		// black: "#5166b2",
		red: tree_red,
		black: tree_black,
	},
	dark: {
		name: "经典深色",
		bg: "#2d2d2d",
		texture: "none",
		grid: "light",
		// red: "#861818",
		// black: "#2090ff",
		red: tree_red,
		black: tree_black,
	},
	auto: {
		name: "自动",
		bg: "var(--background-primary-alt)",
		texture: "none",
		grid: "dark",
		red: "var(--xq-auto-red)",
		black: "var(--xq-auto-black)",
	},
};

export const THEME_OPTIONS = Object.fromEntries(
	Object.entries(themes).map(([k, v]) => [k, v.name]),
) as Record<string, string>;

export function applyThemes(settings: ISettings) {
	const { theme, boardMarginTop, boardMarginBottom, showCoordinateLabels } = settings;
	const t = themes[theme] ?? themes.light;

	document.body.style.setProperty("--xq-board-bg", t.bg);
	document.body.style.setProperty("--xq-board-texture", t.texture);
	document.body.style.setProperty(
		"--xq-grid",
		t.grid === "dark" ? "var(--xq-grid-dark)" : "var(--xq-grid-light)",
	);
	document.body.style.setProperty(
		"--xq-coords-display",
		showCoordinateLabels ? "flex" : "none",
	);
	document.body.style.setProperty("--xq-piece-red", t.red);
	document.body.style.setProperty("--xq-piece-black", t.black);
	document.body.style.setProperty("--board-margin-top", `${boardMarginTop}px`);
	document.body.style.setProperty("--board-margin-bottom", `${boardMarginBottom}px`);
}
