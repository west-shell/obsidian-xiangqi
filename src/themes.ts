const themes = {
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
}

type ThemeKey = keyof typeof themes;

export function applyThemes(theme: ThemeKey | "auto") {
	const isDarkMode = () => document.body.classList.contains("theme-dark");

	let bgColor, lineColor, textColor, red, black;

	if (theme === "auto") {
		// 根据当前主题选择暗色或亮色的棋子颜色
		const autoTheme = isDarkMode() ? "dark" : "light";
		({ red, black } = themes[autoTheme]);

		// 移除背景类属性，让 Obsidian 自己处理
		document.body.style.removeProperty("--xq-board-background");
		document.body.style.removeProperty("--xq-board-line");
		document.body.style.removeProperty("--xq-text-color");
	} else {
		({ bgColor, lineColor, textColor, red, black } = themes[theme]);

		document.body.style.setProperty("--xq-board-background", bgColor);
		document.body.style.setProperty("--xq-board-line", lineColor);
		document.body.style.setProperty("--xq-text-color", textColor);
	}

	// 无论模式如何，都设置棋子颜色
	document.body.style.setProperty("--xq-piece-red", red);
	document.body.style.setProperty("--xq-piece-black", black);
}
