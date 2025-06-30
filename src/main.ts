import { Plugin } from 'obsidian';
import { XQRenderChild } from './xiangqi';
import { GenFENRenderChild } from './genFEN';
import { ISettings } from './types';
import { XQSettingTab, DEFAULT_SETTINGS } from './settings';

export default class XQPlugin extends Plugin {
    settings: ISettings = DEFAULT_SETTINGS;
    renderChildren = new Set<XQRenderChild>();
    async onload() {
        await this.loadSettings();

        this.addSettingTab(new XQSettingTab(this.app, this));
        const codeBlockNames = ['xq', 'xiangqi', '象棋'];
        for (const name of codeBlockNames) {
            this.registerMarkdownCodeBlockProcessor(name, (source, el, ctx) => {
                const renderChild = new XQRenderChild(el, ctx, source, this);
                ctx.addChild(renderChild);
                this.renderChildren.add(renderChild);
            });
        }
        this.registerMarkdownCodeBlockProcessor('xqfen', (source, el, ctx) => {
            const renderChild = new GenFENRenderChild(el, ctx, source, this);
            ctx.addChild(renderChild);
        });
        this.registerEvent(
            this.app.workspace.on('css-change', () => {
                // 主题已改变
                if (this.settings.autoTheme) {
                    const isDarkMode = () => document.body.classList.contains("theme-dark");
                    this.settings.theme = isDarkMode() ? 'dark' : 'light'; // 自动主题时默认使用深色
                    this.refresh();
                }
            })
        );
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
    refresh() {
        this.renderChildren.forEach((child) => {
            child.refresh();
        });
    }
}
