import { Plugin } from "obsidian";
import type { ISettings } from "./types";
import { ChessRenderChild } from "./renderChild/ChessRenderChild";
import { GenFENRenderChild } from './renderChild/GenFENRenderChild';
import { PGNView } from './view/pgn';
import { XQSettingTab, DEFAULT_SETTINGS } from "./settings";

export default class XQPlugin extends Plugin {
	settings: ISettings = DEFAULT_SETTINGS;
	renderChildren: Set<{ refresh(): void }> = new Set();
	async onload() {

		await this.loadSettings();

		this.addSettingTab(new XQSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('xiangqi', (source, el, ctx) => {
			const renderChild = new ChessRenderChild(el, ctx, source, this);
			ctx.addChild(renderChild);
		});

		this.registerMarkdownCodeBlockProcessor('xq', (source, el, ctx) => {
			const renderChild = new GenFENRenderChild(el, ctx, source, this);
			ctx.addChild(renderChild);
		});

		this.registerView(
			PGNView.VIEW_TYPE,
			(leaf) => new PGNView(leaf, this)
		);

		this.registerExtensions(["pgn"], PGNView.VIEW_TYPE);

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				// 主题已改变
				if (this.settings.autoTheme) {
					const isDarkMode = () =>
						document.body.classList.contains("theme-dark");
					this.settings.theme = isDarkMode() ? "dark" : "light"; // 自动主题时默认使用深色
					this.refresh();
				}
			}),
		);
	}

	refresh() {
		this.renderChildren.forEach((child) => {
			child.refresh();
		});
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...savedData,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(PGNView.VIEW_TYPE);
	}


}
