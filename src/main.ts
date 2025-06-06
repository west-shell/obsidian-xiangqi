import { Plugin } from 'obsidian';
import { chessRenderChild } from './xiangqi';
import { ISettings } from './types';
import { settingTab, DEFAULT_SETTINGS } from "./settings";
export default class XiangqiPlugin extends Plugin {
    settings: ISettings = DEFAULT_SETTINGS;
    renderChildren = new Set<chessRenderChild>();
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new settingTab(this.app, this));
        this.registerMarkdownCodeBlockProcessor('xiangqi', (source, el, ctx) => {
            const child = new chessRenderChild(this, this.settings, el, source);
            ctx.addChild(child);
            this.renderChildren.add(child);
        });
    }
    async loadSettings() {
        const savedData = await this.loadData();
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...savedData
        };
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}