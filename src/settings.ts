import XQPlugin from "./main";
import "./settings.css";
import type { ISettings } from "./types";
import { type App, PluginSettingTab, Setting } from "obsidian";
import { THEME_OPTIONS } from "./themes";
import { t, initI18n } from "./i18n";

export const DEFAULT_SETTINGS: ISettings = {
	lang: "auto",
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

		new Setting(containerEl).setName("Language / 语言")
			.addDropdown(d => d.addOptions({ auto: "Auto/跟随软件", en: "English", "zh-cn": "中文" })
				.setValue(settings.lang).onChange(v => {
					settings.lang = v as ISettings["lang"];
					void this.plugin.saveSettings();
					initI18n(v);
					this.display();
				}));

		// ==================== 棋盘外观 ====================
		new Setting(containerEl).setName(t("board.title")).setHeading();

		new Setting(containerEl)
			.setName(t("board.theme"))
			.setDesc(t("board.theme.desc"))
			.addDropdown((dropdown) => {
				dropdown.addOptions(THEME_OPTIONS);
				dropdown.setValue(settings.theme).onChange((theme) => {
					settings.theme = theme as ISettings["theme"];
					void this.plugin.saveSettings();
					this.plugin.refresh();
				});
			});

		addSliderWithValue(
			containerEl,
			t("board.cellSize"),
			t("board.cellSize.desc"),
			settings.cellSize,
			{ min: 15, max: 100, step: 1 },
			"px",
			(v) => {
				settings.cellSize = v;
				void this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		new Setting(containerEl)
			.setName(t("board.layout"))
			.setDesc(t("board.layout.desc"))
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({ right: t("board.layout.side"), bottom: t("board.layout.bottom") })
					.setValue(settings.position)
					.onChange((position) => {
						settings.position = position as "bottom" | "right";
						void this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});

		new Setting(containerEl)
			.setName(t("board.coordinates"))
			.setDesc(t("board.coordinates.desc"))
			.addToggle((toggle) =>
				toggle.setValue(settings.showCoordinateLabels).onChange((value) => {
					settings.showCoordinateLabels = value;
					void this.plugin.saveSettings();
				}),
			);

		// ==================== 对局提示 ====================
		new Setting(containerEl).setName(t("game.title")).setHeading();

		new Setting(containerEl)
			.setName(t("game.lastMove"))
			.setDesc(t("game.lastMove.desc"))
			.addToggle((toggle) =>
				toggle.setValue(settings.showLastMove).onChange((value) => {
					settings.showLastMove = value;
					void this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName(t("game.legalMoves"))
			.setDesc(t("game.legalMoves.desc"))
			.addToggle((toggle) =>
				toggle.setValue(settings.showNextMove).onChange((value) => {
					settings.showNextMove = value;
					void this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName(t("game.turnBorder"))
			.setDesc(t("game.turnBorder.desc"))
			.addToggle((toggle) =>
				toggle.setValue(settings.showTurnBorder).onChange((value) => {
					settings.showTurnBorder = value;
					void this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		if (window.speechSynthesis) {
			new Setting(containerEl)
				.setName(t("game.speech"))
				.setDesc(t("game.speech.desc"))
				.addToggle((toggle) =>
					toggle.setValue(settings.enableSpeech).onChange((value) => {
						settings.enableSpeech = value;
						void this.plugin.saveSettings();
					}),
				);
		}

		// ==================== 着法列表 ====================
		new Setting(containerEl).setName(t("movelist.title")).setHeading();

		new Setting(containerEl)
			.setName(t("movelist.show"))
			.setDesc(t("movelist.show.desc"))
			.addToggle((toggle) =>
				toggle.setValue(settings.showMovelist).onChange((value) => {
					settings.showMovelist = value;
					void this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName(t("movelist.text"))
			.setDesc(t("movelist.text.desc"))
			.addToggle((toggle) =>
				toggle.setValue(settings.showMovelistText).onChange((value) => {
					settings.showMovelistText = value;
					void this.plugin.saveSettings();
					this.plugin.refresh();
					this.display();
				}),
			);

		addSliderWithValue(
			containerEl,
			t("movelist.fontSize"),
			t("movelist.fontSize.desc"),
			settings.fontSize,
			{ min: 10, max: 25, step: 1 },
			"px",
			(v) => {
				settings.fontSize = v;
				void this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		new Setting(containerEl)
			.setName(t("movelist.autoJump"))
			.setDesc(t("movelist.autoJump.desc"))
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						never: t("movelist.autoJump.never"),
						always: t("movelist.autoJump.always"),
						auto: t("movelist.autoJump.auto"),
					})
					.setValue(settings.autoJump)
					.onChange(async (value) => {
						settings.autoJump = value as "never" | "always" | "auto";
						void this.plugin.saveSettings();
					});
			});

		// ---- 边距 ----
		new Setting(containerEl).setName(t("margin.title")).setHeading();

		addSliderWithValue(
			containerEl,
			t("margin.top"),
			t("margin.top.desc"),
			settings.boardMarginTop,
			{ min: 0, max: 100, step: 1 },
			"px",
			(v) => {
				settings.boardMarginTop = v;
				void this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		addSliderWithValue(
			containerEl,
			t("margin.bottom"),
			t("margin.bottom.desc"),
			settings.boardMarginBottom,
			{ min: 0, max: 100, step: 1 },
			"px",
			(v) => {
				settings.boardMarginBottom = v;
				void this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		containerEl.parentElement?.classList.add("xq-setting-tab");
	}

	async hide() {
		this.plugin.refresh();
	}
}
