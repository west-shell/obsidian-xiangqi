import XQPlugin from "./main";
import type { ISettings } from "./types";
import { type App, PluginSettingTab, Setting } from "obsidian";

export const DEFAULT_SETTINGS: ISettings = {
	position: "right",
	theme: "auto",
	cellSize: 50,
	fontSize: 12,
	showLastMove: true,
	showTurnBorder: true,
	autoJump: "auto",
	enableSpeech: true,
	displayMovelist: true,
	displayMovelistText: true,
	viewOnly: false,
	rotated: false,
};

export class XQSettingTab extends PluginSettingTab {
	plugin: XQPlugin;

	constructor(app: App, plugin: XQPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const settings = this.plugin.settings;
		let { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("主题")
			// .setDesc("设置棋盘主题.")
			.addDropdown((dropdown) => {
				dropdown.addOptions({
					light: "浅色",
					dark: "深色",
					auto: "跟随",
				});
				dropdown
					.setValue(settings.theme)
					.onChange((theme) => {
						settings.theme = theme as "auto" | "light" | "dark";
						this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});

		new Setting(containerEl)
			.setName("布局")
			// .setDesc("设置按钮的位置.")
			.addDropdown((dropdown) => {
				dropdown.addOptions({
					right: "横向",
					bottom: "纵向",
				});

				dropdown.setValue(settings.position).onChange((position) => {
					settings.position = position as "bottom" | "right";
					this.plugin.saveSettings();
					this.plugin.refresh();
				});
			});

		new Setting(containerEl)
			.setName("界面大小")
			// .setDesc("调整棋盘大小")
			.addSlider((slider) => {
				const controlEl = slider.sliderEl.parentElement!;
				// 创建显示滑块值的标签
				const valueLabel = createEl("span", {
					text: Math.abs(settings.cellSize).toString(),
					cls: "slider-value-label",
				});
				controlEl.prepend(valueLabel);
				slider
					.setLimits(15, 100, 1)
					.setValue(settings.cellSize) // 默认值
					.onChange((value) => {
						settings.cellSize = value;
						valueLabel.textContent = value.toString(); // 确保实时更新显示值
						this.plugin.saveSettings();
						this.plugin.refresh();
					});
				// 监听 input 事件，实现拖动时实时更新
				slider.sliderEl.addEventListener("input", () => {
					const value = slider.getValue();
					settings.cellSize = value;
					valueLabel.textContent = value.toString();
				});
			});

		new Setting(containerEl).setName("轮次提示").setHeading();

		new Setting(containerEl)
			// .setName("是否显示当前着法")
			.setDesc("是否显示当前着法")
			.addToggle((toggle) =>
				toggle.setValue(settings.showLastMove).onChange((value) => {
					settings.showLastMove = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);
		new Setting(containerEl)
			// .setName("是否显示当前该谁行棋的边框")
			.setDesc("是否显示当前该谁行棋的边框")
			.addToggle((toggle) =>
				toggle.setValue(settings.showTurnBorder).onChange((value) => {
					settings.showTurnBorder = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl).setName("着法列表").setHeading();

		new Setting(containerEl)
			// .setName("是否启用着法列表")
			.setDesc("是否显示棋谱着法列表")
			.addToggle((toggle) =>
				toggle.setValue(settings.displayMovelist).onChange((value) => {
					settings.displayMovelist = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			// .setName("是否显示着法文字")
			.setDesc("是否显示棋谱着法文字")
			.addToggle((toggle) =>
				toggle.setValue(settings.displayMovelistText).onChange((value) => {
					settings.displayMovelistText = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
					this.display();
				}),
			);
		new Setting(containerEl)
			// .setName("着法文字大小")
			.setDesc("调整着法文字大小")
			.addSlider((slider) => {
				const controlEl = slider.sliderEl.parentElement!;
				// 创建显示滑块值的标签
				const valueLabel = createEl("span", {
					text: Math.abs(settings.fontSize).toString(),
					cls: "slider-value-label",
				});
				controlEl.prepend(valueLabel);
				slider
					.setLimits(10, 25, 1)
					.setValue(settings.fontSize) // 默认值
					.onChange((value) => {
						settings.fontSize = value;
						valueLabel.textContent = value.toString(); // 确保实时更新显示值
						this.plugin.saveSettings();
						this.plugin.refresh();
					});
				// 监听 input 事件，实现拖动时实时更新
				slider.sliderEl.addEventListener("input", () => {
					const value = slider.getValue();
					settings.fontSize = value;
					valueLabel.textContent = value.toString();
				});
			});

		new Setting(containerEl)
			.setName("开局跳转")
			.setDesc("初始渲染时是否直接跳转至终局")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						never: "从不",
						always: "始终",
						auto: "无FEN即正常开局时",
					})
					.setValue(settings.autoJump)
					.onChange(async (value) => {
						settings.autoJump = value as "never" | "always" | "auto";
						this.plugin.saveSettings();
					});
			});

		if (window.speechSynthesis) {
			new Setting(containerEl)
				.setName("朗读着法")
				// .setDesc("是否朗读棋谱走法")
				.addToggle((toggle) =>
					toggle.setValue(settings.enableSpeech).onChange((value) => {
						settings.enableSpeech = value;
						this.plugin.saveSettings();
					}),
				);
		}
	}
	async hide() {
		this.plugin.refresh();

	}
}
