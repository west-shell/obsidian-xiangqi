import XiangqiPlugin from "./main";
import { chessRenderChild } from "./xiangqi";
import { ISettings } from "./types";
import {  App, PluginSettingTab, Setting,} from "obsidian";

const LAYOUT_POSITIONS = ["bottom", "right"];
const THEME_STYLES = ["light", "dark"];


export const DEFAULT_SETTINGS: ISettings = {
  position: 'right',
  theme: 'light',
  cellSize: 50
};

export class settingTab extends PluginSettingTab {
  plugin: XiangqiPlugin;

  constructor(app: App, plugin: XiangqiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("主题")
      .setDesc("设置棋盘主题.")
      .addDropdown((dropdown) => {
        let styles: Record<string, string> = {};
        THEME_STYLES.map((style) => (styles[style] = style));
        dropdown.addOptions(styles);
        dropdown.setValue(this.plugin.settings.theme).onChange((theme) => {
          this.plugin.settings.theme = theme as 'light' | 'dark';
        });
      });

    new Setting(containerEl)
      .setName("按钮布局")
      .setDesc("设置按钮的位置.")
      .addDropdown((dropdown) => {
        let positions: Record<string, string> = {};
        LAYOUT_POSITIONS.map((position) => (positions[position] = position));
        dropdown.addOptions(positions);

        dropdown.setValue(this.plugin.settings.position).onChange((position) => {
          this.plugin.settings.position = position as 'bottom' | 'right';
        });
      });

    new Setting(containerEl)
      .setName("界面大小")
      .setDesc("调整界面大小")
      .addSlider((slider) => {
        slider
          .setLimits(20, 60, 1)
          .setValue(this.plugin.settings.cellSize) // 默认值
          .onChange(async (value) => {
            this.plugin.settings.cellSize = value;
          });

        // // 可选：在滑块旁边显示当前值
        // slider.sliderEl.createSpan({
        //   text: ` ${this.plugin.settings.cellSize}px`,
        //   cls: "slider-value",
        // });
        // // 实时更新显示值
        // slider.sliderEl.oninput = (evt) => {
        //   const value = (evt.target as HTMLInputElement).value;
        //   const displayEl = slider.sliderEl.nextSibling as HTMLSpanElement;
        //   if (displayEl) displayEl.textContent = ` ${value}px`;
        // };
      });
  }
  async hide() {
    // 1. 保存设置
    this.plugin.saveSettings();
    this.plugin.renderChildren.forEach((child) => {
      if (child instanceof chessRenderChild) {
        child.refresh();
      }
    })
  }
}
