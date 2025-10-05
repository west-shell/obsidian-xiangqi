import { Plugin } from "obsidian";
import type { ISettings } from "./types";
import { applyThemes } from "./themes";
import { ChessRenderChild } from "./renderChild/MoveListRenderChild";
import { GenFENRenderChild } from './renderChild/GenFENRenderChild';
import { PGNView } from './view/pgn';
import { XQSettingTab, DEFAULT_SETTINGS } from "./settings";

export default class XQPlugin extends Plugin {
	settings: ISettings = DEFAULT_SETTINGS;
	renderChildren: Set<{ refresh(): void }> = new Set();
	async onload() {

		await this.loadSettings();

		this.addSettingTab(new XQSettingTab(this.app, this));

		applyThemes(this.settings.theme);

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

		this.addRibbonIcon("file-plus", "新建 PGN 文件", async () => {
			let baseFileName = "未命名";
			let fileExtension = ".pgn";
			let fileName = baseFileName + fileExtension;
			let counter = 0;

			// 检查文件是否存在，如果存在则递增文件名
			while (await this.app.vault.adapter.exists(fileName)) {
				counter++;
				fileName = `${baseFileName} ${counter}${fileExtension}`;
			}

			const fileContent = ""; // 用户要求内容留空白

			try {
				const newFile = await this.app.vault.create(fileName, fileContent);
				this.app.workspace.getLeaf(true).openFile(newFile);
			} catch (error) {
				console.error("创建 PGN 文件失败:", error);
			}
		});

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				// 主题已改变
				if (this.settings.theme === "auto") {
					applyThemes(this.settings.theme)
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
		applyThemes(this.settings.theme);
	}

}
