import { Plugin } from 'obsidian';
import { BoardRender } from './xiangqi';
import { ISettings, settingTab, DEFAULT_SETTINGS } from "./settings";
export default class XiangqiPlugin extends Plugin {
    settings!: ISettings;
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new settingTab(this.app, this));
        this.registerMarkdownCodeBlockProcessor('xiangqi', (source, el) => {
            new BoardRender(this.settings, el, source).main();
        });
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}