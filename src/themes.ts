// components/themes.ts
export const themes = {
	light: {
		bgColor: "#E8C887",
		lineColor: "#000000",
		textColor: "#000000",
		red: "#b24747ff",
		black: "#5166b2ff",
	},
	dark: {
		bgColor: "#2d2d2d",
		lineColor: "#ffffff",
		textColor: "#ffffff",
		red: "#861818",
		black: "#000080",
	},
};

export type ThemeKey = keyof typeof themes;

export function applyThemes(theme: ThemeKey, autoTheme?: boolean) {

	let { bgColor, lineColor, textColor, red, black, } = themes[theme];
	document.body.style.setProperty("--xq-piece-red", red);
	document.body.style.setProperty("--xq-piece-black", black);
	if (autoTheme) {
		document.body.style.removeProperty("--xq-board-background");
		document.body.style.removeProperty("--xq-board-line");
		document.body.style.removeProperty("--xq-text-color");
	} else {
		document.body.style.setProperty("--xq-board-background", bgColor);
		document.body.style.setProperty("--xq-board-line", lineColor);
		document.body.style.setProperty("--xq-text-color", textColor);
	}

}