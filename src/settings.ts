import XQPlugin from "./main";
import type { ISettings } from "./types";
import { type App, PluginSettingTab, Setting } from "obsidian";
import { THEME_OPTIONS } from "./themes";

export const DEFAULT_SETTINGS: ISettings = {
	position: "right",
	theme: "wood",
	cellSize: 50,
	fontSize: 12,
	showCoordinateLabels: true,
	showLastMove: true,
	showNextMove: true,
	showTurnBorder: true,
	autoJump: "auto",
	enableSpeech: true,
	showMovelist: true,
	showMovelistText: true,
	boardMarginTop: 20,
	boardMarginBottom: 20,
	viewOnly: false,
	rotated: false,
};

function addSliderWithValue(
	containerEl: HTMLElement,
	name: string,
	desc: string,
	value: number,
	limits: { min: number; max: number; step: number },
	unit: string,
	onChange: (v: number) => void,
) {
	let currentValue = value;
	const setting = new Setting(containerEl).setName(name).setDesc(desc);

	const valueDisplay = createSpan({ cls: "xq-slider-value" });
	valueDisplay.setText(`${currentValue}${unit}`);
	setting.controlEl.prepend(valueDisplay);

	setting.addSlider((slider) => {
		slider.setLimits(limits.min, limits.max, limits.step).setValue(currentValue);
		slider.onChange((v) => {
			currentValue = v;
			valueDisplay.setText(`${v}${unit}`);
			onChange(v);
		});
		// 拖动时实时更新
		slider.sliderEl.addEventListener("input", () => {
			const v = slider.getValue();
			currentValue = v;
			valueDisplay.setText(`${v}${unit}`);
		});
	});

	return setting;
}

export class XQSettingTab extends PluginSettingTab {
	plugin: XQPlugin;

	constructor(app: App, plugin: XQPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const settings = this.plugin.settings;
		const { containerEl } = this;
		containerEl.empty();

		// ==================== 棋盘外观 ====================
		containerEl.createEl("h2", { text: "棋盘外观" });

		new Setting(containerEl)
			.setName("主题")
			.setDesc("切换棋盘配色与纹理")
			.addDropdown((dropdown) => {
				dropdown.addOptions(THEME_OPTIONS);
				dropdown.setValue(settings.theme).onChange((theme) => {
					settings.theme = theme as ISettings["theme"];
					this.plugin.saveSettings();
					this.plugin.refresh();
				});
			});

		addSliderWithValue(
			containerEl,
			"界面大小",
			"调整棋盘和棋子的显示尺寸",
			settings.cellSize,
			{ min: 15, max: 100, step: 1 },
			"px",
			(v) => {
				settings.cellSize = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		new Setting(containerEl)
			.setName("布局")
			.setDesc("工具栏在棋盘的右侧还是底部")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({ right: "横向", bottom: "纵向" })
					.setValue(settings.position)
					.onChange((position) => {
						settings.position = position as "bottom" | "right";
						this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});

		new Setting(containerEl)
			.setName("显示坐标标签")
			.setDesc("在棋盘边缘显示「一二三四五…」和「12345…」列号")
			.addToggle((toggle) =>
				toggle.setValue(settings.showCoordinateLabels).onChange((value) => {
					settings.showCoordinateLabels = value;
					this.plugin.saveSettings();
				}),
			);

		// ==================== 对局提示 ====================
		containerEl.createEl("h2", { text: "对局提示" });

		new Setting(containerEl)
			.setName("显示当前着法")
			.setDesc("高亮上一步走棋的起止位置")
			.addToggle((toggle) =>
				toggle.setValue(settings.showLastMove).onChange((value) => {
					settings.showLastMove = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName("显示下一步着法")
			.setDesc("标记当前选中棋子的可走位置")
			.addToggle((toggle) =>
				toggle.setValue(settings.showNextMove).onChange((value) => {
					settings.showNextMove = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName("显示行棋边框")
			.setDesc("在行棋方一侧显示高亮边框提示轮到谁走")
			.addToggle((toggle) =>
				toggle.setValue(settings.showTurnBorder).onChange((value) => {
					settings.showTurnBorder = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		if (window.speechSynthesis) {
			new Setting(containerEl)
				.setName("朗读着法")
				.setDesc("走棋时用语音播报着法内容（移动端不支持）")
				.addToggle((toggle) =>
					toggle.setValue(settings.enableSpeech).onChange((value) => {
						settings.enableSpeech = value;
						this.plugin.saveSettings();
					}),
				);
		}

		// ==================== 着法列表 ====================
		containerEl.createEl("h2", { text: "着法列表" });

		new Setting(containerEl)
			.setName("显示着法面板")
			.setDesc("在棋盘旁显示完整的走棋记录和变招")
			.addToggle((toggle) =>
				toggle.setValue(settings.showMovelist).onChange((value) => {
					settings.showMovelist = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName("显示着法文字")
			.setDesc("着法列表中显示每一步的中文描述")
			.addToggle((toggle) =>
				toggle.setValue(settings.showMovelistText).onChange((value) => {
					settings.showMovelistText = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
					this.display();
				}),
			);

		addSliderWithValue(
			containerEl,
			"着法文字大小",
			"调整着法列表中文字的显示大小",
			settings.fontSize,
			{ min: 10, max: 25, step: 1 },
			"px",
			(v) => {
				settings.fontSize = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		new Setting(containerEl)
			.setName("开局跳转")
			.setDesc("打开棋谱时自动定位到哪一步")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						never: "不跳转",
						always: "始终跳转至末尾",
						auto: "仅默认开局时跳转",
					})
					.setValue(settings.autoJump)
					.onChange(async (value) => {
						settings.autoJump = value as "never" | "always" | "auto";
						this.plugin.saveSettings();
					});
			});

		// ---- 边距 ----
		containerEl.createEl("h3", { text: "棋盘边距" });

		addSliderWithValue(
			containerEl,
			"上边距",
			"棋盘顶部的留白距离",
			settings.boardMarginTop,
			{ min: 0, max: 100, step: 1 },
			"px",
			(v) => {
				settings.boardMarginTop = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		addSliderWithValue(
			containerEl,
			"下边距",
			"棋盘底部的留白距离",
			settings.boardMarginBottom,
			{ min: 0, max: 100, step: 1 },
			"px",
			(v) => {
				settings.boardMarginBottom = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		// 加一点样式
		const style = containerEl.createEl("style");
		style.textContent = `
			.xq-slider-value {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 42px;
				height: 24px;
				margin-right: 8px;
				font-size: 13px;
				font-weight: 600;
				color: var(--text-accent);
				background: var(--background-modifier-border);
				border-radius: 4px;
				padding: 0 6px;
			}
			.xq-setting-tab .setting-item {
				border-top: none;
			}
		`;
		containerEl.parentElement?.classList.add("xq-setting-tab");
	}

	async hide() {
		this.plugin.refresh();
	}
}
