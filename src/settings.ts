import XQPlugin from './main';
import { ISettings } from './types';
import { App, PluginSettingTab, Setting } from 'obsidian';

export const DEFAULT_SETTINGS: ISettings = {
    position: 'right',
    theme: 'dark',
    autoTheme: true,
    cellSize: 50,
    fontSize: -15,
    autoJump: 'auto',
    enableSpeech: true,
    showPGN: true,
    showPGNtxt: true,
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
            .setName('主题')
            .setDesc('设置棋盘主题.')
            .addDropdown((dropdown) => {
                dropdown.addOptions({
                    light: '浅色',
                    dark: '深色',
                    auto: '跟随'
                });
                dropdown.setValue(settings.autoTheme ? 'auto' : settings.theme).onChange((theme) => {
                    if (theme === 'auto') {
                        settings.autoTheme = true;
                        const isDarkMode = () => document.body.classList.contains("theme-dark");
                        settings.theme = isDarkMode() ? 'dark' : 'light' // 自动主题时默认使用深色
                    } else {
                        settings.autoTheme = false;
                        settings.theme = theme as 'light' | 'dark';
                    }
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

                dropdown.setValue(settings.position).onChange((position) => {
                    settings.position = position as 'bottom' | 'right';
                });
            });

        new Setting(containerEl)
            .setName('界面大小')
            .setDesc('调整棋盘大小')
            .addSlider((slider) => {
                slider
                    .setLimits(25, 100, 1)
                    .setValue(settings.cellSize) // 默认值
                    .onChange((value) => {
                        settings.cellSize = value;
                    });
            });

        containerEl.createEl('h2', { text: '着法列表' });

        new Setting(containerEl)
            .setName('启用着法列表')
            .setDesc('是否显示棋谱')
            .addToggle((toggle) =>
                toggle.setValue(settings.showPGN).onChange((value) => {
                    settings.showPGN = value;
                }),
            );

        new Setting(containerEl)
            .setName('显示着法文字')
            .setDesc('是否显示棋谱着法文字')
            .addToggle((toggle) =>
                toggle.setValue(settings.showPGNtxt).onChange((value) => {
                    settings.showPGNtxt = value;
                    this.display();
                }),
            );

        if (settings.showPGNtxt) {
            new Setting(containerEl)
                .setName('着法字体调整')
                .setDesc('开启自动或手动调节')
                .addToggle((toggle) => {
                    // 根据 settings.fontSize 初始判断自动模式
                    toggle.setValue(settings.fontSize < 0);

                    const controlEl = toggle.toggleEl.parentElement!;
                    controlEl.style.display = 'flex';
                    controlEl.style.alignItems = 'center';
                    controlEl.style.gap = '1em';

                    // 创建滑块
                    const rangeSlider = createEl('input', {
                        type: 'range',
                        attr: {
                            min: '5',
                            max: '25',
                            value: Math.abs(settings.fontSize).toString(),
                        },
                    });
                    rangeSlider.addClass('slider');
                    rangeSlider.addClass('mod-range');
                    rangeSlider.style.flex = '1';

                    // 创建显示滑块值的标签
                    const valueLabel = createEl('span', {
                        text: Math.abs(settings.fontSize).toString(),
                    });
                    valueLabel.style.minWidth = '2.5em'; // 防止数字宽度抖动

                    // 根据 toggle 初始值显示或隐藏滑块和数字
                    if (settings.fontSize < 0) {
                        rangeSlider.style.display = 'none';
                        valueLabel.style.display = 'none';
                    } else {
                        rangeSlider.style.display = 'inline-block';
                        valueLabel.style.display = 'inline-block';
                    }

                    // 插入滑块和标签到 toggle 左侧
                    controlEl.prepend(valueLabel);
                    controlEl.prepend(rangeSlider);

                    // toggle 切换时显示或隐藏滑块和标签，同时同步 settings.fontSize
                    toggle.onChange((value) => {
                        if (value) {
                            // 自动模式，字体大小为负数
                            settings.fontSize = -Math.abs(settings.fontSize);
                            rangeSlider.style.display = 'none';
                            valueLabel.style.display = 'none';
                        } else {
                            // 手动模式，字体大小为正数
                            settings.fontSize = Math.abs(settings.fontSize);
                            rangeSlider.style.display = 'inline-block';
                            valueLabel.style.display = 'inline-block';
                        }
                    });

                    // 滑块拖动时更新 settings.fontSize 和显示标签
                    rangeSlider.addEventListener('input', (e) => {
                        const val = Number((e.target as HTMLInputElement).value);
                        settings.fontSize = val;
                        valueLabel.textContent = val.toString();
                    });
                });
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
                    .setValue(settings.autoJump)
                    .onChange(async (value) => {
                        settings.autoJump = value as 'never' | 'always' | 'auto';
                    });
            });

        if (window.speechSynthesis) {
            new Setting(containerEl)
                .setName('朗读着法')
                .setDesc('是否朗读棋谱走法')
                .addToggle((toggle) =>
                    toggle.setValue(settings.enableSpeech).onChange((value) => {
                        settings.enableSpeech = value;
                    }),
                );
        }
    }
    async hide() {
        this.plugin.saveSettings();
        this.plugin.renderChildren.forEach((child) => child.refresh());
    }
}
