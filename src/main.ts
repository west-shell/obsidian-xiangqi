import { Plugin } from 'obsidian';
import { XQRenderChild } from './xiangqi';
import { ISettings } from './types';
import { XQSettingTab, DEFAULT_SETTINGS } from './settings';
export default class XQPlugin extends Plugin {
  settings: ISettings = DEFAULT_SETTINGS;
  renderChildren = new Set<XQRenderChild>();
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new XQSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor('xiangqi', (source, el, ctx) => {
      const renderChild = new XQRenderChild(el, ctx, source, this);
      ctx.addChild(renderChild);
      this.renderChildren.add(renderChild);
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
}
