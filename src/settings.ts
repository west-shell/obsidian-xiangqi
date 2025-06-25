import XQPlugin from './main';
import { ISettings } from './types';
import { App, PluginSettingTab, Setting } from 'obsidian';

const LAYOUT_POSITIONS = ['bottom', 'right'];
const THEME_STYLES = ['light', 'dark'];

export const DEFAULT_SETTINGS: ISettings = {
    position: 'right',
    theme: 'light',
    cellSize: 50,
    enableSpeech: true,
    autoJump: 'auto',
};

export class XQSettingTab extends PluginSettingTab {
    plugin: XQPlugin;

    constructor(app: App, plugin: XQPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('主题')
            .setDesc('设置棋盘主题.')
            .addDropdown((dropdown) => {
                dropdown.addOptions({
                    light: '浅色',
                    dark: '深色',
                });
                dropdown.setValue(this.plugin.settings.theme).onChange((theme) => {
                    this.plugin.settings.theme = theme as 'light' | 'dark';
                });
            });

        new Setting(containerEl)
            .setName('按钮布局')
            .setDesc('设置按钮的位置.')
            .addDropdown((dropdown) => {
                dropdown.addOptions({
                    right: '右侧',
                    bottom: '底部',
                });

                dropdown.setValue(this.plugin.settings.position).onChange((position) => {
                    this.plugin.settings.position = position as 'bottom' | 'right';
                });
            });

        new Setting(containerEl)
            .setName('界面大小')
            .setDesc('调整界面大小')
            .addSlider((slider) => {
                slider
                    .setLimits(20, 60, 1)
                    .setValue(this.plugin.settings.cellSize) // 默认值
                    .onChange(async (value) => {
                        this.plugin.settings.cellSize = value;
                    });
            });
        if (window.speechSynthesis) {
            new Setting(containerEl)
                .setName('启用棋谱朗读')
                .setDesc('是否朗读棋谱走法')
                .addToggle((toggle) =>
                    toggle.setValue(this.plugin.settings.enableSpeech).onChange(async (value) => {
                        this.plugin.settings.enableSpeech = value;
                    }),
                );
        }
        new Setting(containerEl)
            .setName('开局跳转')
            .setDesc('初始渲染时默认跳转至终局')
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        never: '从不',
                        always: '始终',
                        auto: '无FEN即正常开局时',
                    })
                    .setValue(this.plugin.settings.autoJump || 'auto') // 默认选"无FEN时"
                    .onChange(async (value) => {
                        this.plugin.settings.autoJump = value as 'never' | 'always' | 'auto';
                    });
            });
    }
    async hide() {
        this.plugin.saveSettings();
        this.plugin.renderChildren.forEach((child) => child.refresh());
    }
}
