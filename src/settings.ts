import './style/settings.css';

import { type App, PluginSettingTab, Setting } from 'obsidian';

import { initI18n, t } from './i18n';
import type ChessPlugin from './main';
import { THEME_KEYS } from './themes';
import type { ISettings } from './types';

export const DEFAULT_SETTINGS: ISettings = {
  lang: 'auto',
  position: 'right',
  theme: 'wood',
  cellSize: 50,
  fontSize: 12,
  showCoordinateLabels: true,
  showLastMove: true,
  showNextMove: true,
  showTurnBorder: true,
  autoJump: 'auto',
  enableSpeech: true,
  showMovelist: true,
  showMovelistText: true,
  boardMarginTop: 20,
  boardMarginBottom: 20,
  viewOnly: false,
  rotated: false,
  codeBlockNames: {
    xiangqi: ['xiangqi'],
    xq: ['xq'],
    tree: ['tree'],
  },
  genfenSaveType: 'xiangqi',
  enablePGNView: true,
  pgnFileExtensions: ['pgn'],
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

  const valueDisplay = createSpan({ cls: 'ws-slider-value' });
  valueDisplay.setText(`${currentValue}${unit}`);
  setting.controlEl.prepend(valueDisplay);

  setting.addSlider(slider => {
    slider.setLimits(limits.min, limits.max, limits.step).setValue(currentValue);
    slider.onChange(v => {
      currentValue = v;
      valueDisplay.setText(`${v}${unit}`);
      onChange(v);
    });
    // 拖动时实时更新
    slider.sliderEl.addEventListener('input', () => {
      const v = slider.getValue();
      currentValue = v;
      valueDisplay.setText(`${v}${unit}`);
    });
  });

  return setting;
}

export class ChessSettingTab extends PluginSettingTab {
  plugin: ChessPlugin;

  constructor(app: App, plugin: ChessPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const settings = this.plugin.settings;
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Language / 语言').addDropdown(d =>
      d
        .addOptions({ auto: 'Auto/跟随软件', en: 'English', zh: '中文' })
        .setValue(settings.lang)
        .onChange(v => {
          settings.lang = v as ISettings['lang'];
          initI18n(v);
          this.display();
        }),
    );

    // ==================== 棋盘外观 ====================
    new Setting(containerEl).setName(t('board.title')).setHeading();

    new Setting(containerEl)
      .setName(t('board.theme'))
      .setDesc(t('board.theme.desc'))
      .addDropdown(dropdown => {
        dropdown.addOptions(Object.fromEntries(THEME_KEYS.map(k => [k, t(`theme.${k}`)])));
        dropdown.setValue(settings.theme).onChange(theme => {
          settings.theme = theme as ISettings['theme'];
          this.plugin.refresh();
        });
      });

    addSliderWithValue(
      containerEl,
      t('board.cellSize'),
      t('board.cellSize.desc'),
      settings.cellSize,
      { min: 15, max: 100, step: 1 },
      'px',
      v => {
        settings.cellSize = v;
        this.plugin.refresh();
      },
    );

    new Setting(containerEl)
      .setName(t('board.layout'))
      .setDesc(t('board.layout.desc'))
      .addDropdown(dropdown => {
        dropdown
          .addOptions({ right: t('board.layout.side'), bottom: t('board.layout.bottom') })
          .setValue(settings.position)
          .onChange(position => {
            settings.position = position as 'bottom' | 'right';
            this.plugin.refresh();
          });
      });

    new Setting(containerEl)
      .setName(t('board.coordinates'))
      .setDesc(t('board.coordinates.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.showCoordinateLabels).onChange(value => {
          settings.showCoordinateLabels = value;
        }),
      );

    // ==================== 对局提示 ====================
    new Setting(containerEl).setName(t('game.title')).setHeading();

    new Setting(containerEl)
      .setName(t('game.lastMove'))
      .setDesc(t('game.lastMove.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.showLastMove).onChange(value => {
          settings.showLastMove = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t('game.legalMoves'))
      .setDesc(t('game.legalMoves.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.showNextMove).onChange(value => {
          settings.showNextMove = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t('game.turnBorder'))
      .setDesc(t('game.turnBorder.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.showTurnBorder).onChange(value => {
          settings.showTurnBorder = value;
          this.plugin.refresh();
        }),
      );

    if (window.speechSynthesis) {
      new Setting(containerEl)
        .setName(t('game.speech'))
        .setDesc(t('game.speech.desc'))
        .addToggle(toggle =>
          toggle.setValue(settings.enableSpeech).onChange(value => {
            settings.enableSpeech = value;
          }),
        );
    }

    // ==================== 着法列表 ====================
    new Setting(containerEl).setName(t('movelist.title')).setHeading();

    new Setting(containerEl)
      .setName(t('movelist.show'))
      .setDesc(t('movelist.show.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.showMovelist).onChange(value => {
          settings.showMovelist = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t('movelist.text'))
      .setDesc(t('movelist.text.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.showMovelistText).onChange(value => {
          settings.showMovelistText = value;
          this.plugin.refresh();
          this.display();
        }),
      );

    addSliderWithValue(
      containerEl,
      t('movelist.fontSize'),
      t('movelist.fontSize.desc'),
      settings.fontSize,
      { min: 10, max: 25, step: 1 },
      'px',
      v => {
        settings.fontSize = v;
        this.plugin.refresh();
      },
    );

    new Setting(containerEl)
      .setName(t('movelist.autoJump'))
      .setDesc(t('movelist.autoJump.desc'))
      .addDropdown(dropdown => {
        dropdown
          .addOptions({
            never: t('movelist.autoJump.never'),
            always: t('movelist.autoJump.always'),
            auto: t('movelist.autoJump.auto'),
          })
          .setValue(settings.autoJump)
          .onChange(async value => {
            settings.autoJump = value as 'never' | 'always' | 'auto';
          });
      });

    // ---- 边距 ----
    new Setting(containerEl).setName(t('margin.title')).setHeading();

    addSliderWithValue(
      containerEl,
      t('margin.top'),
      t('margin.top.desc'),
      settings.boardMarginTop,
      { min: 0, max: 100, step: 1 },
      'px',
      v => {
        settings.boardMarginTop = v;
        this.plugin.refresh();
      },
    );

    addSliderWithValue(
      containerEl,
      t('margin.bottom'),
      t('margin.bottom.desc'),
      settings.boardMarginBottom,
      { min: 0, max: 100, step: 1 },
      'px',
      v => {
        settings.boardMarginBottom = v;
        this.plugin.refresh();
      },
    );

    // ==================== 代码块名称 ====================
    // ==================== 重启后生效的设置 ====================
    new Setting(containerEl)
      .setName(t('settings.restartRequired.title'))
      .setDesc(t('settings.restartRequired.desc'))
      .setHeading();

    // ---- 代码块名称 ----
    new Setting(containerEl).setName(t('codeblock.title')).setHeading();

    const xiangqiSetting = new Setting(containerEl)
      .setName(t('codeblock.xiangqiAliases'))
      .setDesc(t('codeblock.xiangqiAliases.desc') + ' (默认: xiangqi)')
      .addText(text =>
        text.setValue(settings.codeBlockNames.xiangqi.join(', ')).onChange(value => {
          settings.codeBlockNames.xiangqi = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          void this.plugin.saveSettings();
        }),
      )
      .addButton(button =>
        button.setIcon('rotate-ccw').onClick(() => {
          settings.codeBlockNames.xiangqi = ['xiangqi'];
          xiangqiSetting.controlEl.querySelector('input')!.value = 'xiangqi';
          void this.plugin.saveSettings();
        }),
      );

    const treeSetting = new Setting(containerEl)
      .setName(t('codeblock.treeAliases'))
      .setDesc(t('codeblock.treeAliases.desc') + ' (默认: tree)')
      .addText(text =>
        text.setValue(settings.codeBlockNames.tree.join(', ')).onChange(value => {
          settings.codeBlockNames.tree = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          void this.plugin.saveSettings();
        }),
      )
      .addButton(button =>
        button.setIcon('rotate-ccw').onClick(() => {
          settings.codeBlockNames.tree = ['tree'];
          treeSetting.controlEl.querySelector('input')!.value = 'tree';
          void this.plugin.saveSettings();
        }),
      );

    const xqSetting = new Setting(containerEl)
      .setName(t('codeblock.xqAliases'))
      .setDesc(t('codeblock.xqAliases.desc') + ' (默认: xq)')
      .addText(text =>
        text.setValue(settings.codeBlockNames.xq.join(', ')).onChange(value => {
          settings.codeBlockNames.xq = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          void this.plugin.saveSettings();
        }),
      )
      .addButton(button =>
        button.setIcon('rotate-ccw').onClick(() => {
          settings.codeBlockNames.xq = ['xq'];
          xqSetting.controlEl.querySelector('input')!.value = 'xq';
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t('codeblock.genfenSaveType'))
      .setDesc(t('codeblock.genfenSaveType.desc'))
      .addDropdown(dropdown =>
        dropdown
          .addOptions({ xiangqi: t('codeblock.modeXiangqi'), tree: t('codeblock.modeBranch') })
          .setValue(settings.genfenSaveType)
          .onChange(value => {
            settings.genfenSaveType = value as 'xiangqi' | 'tree';
            void this.plugin.saveSettings();
          }),
      );

    // ---- PGN 文件视图 ----
    new Setting(containerEl).setName(t('pgn.title')).setHeading();

    new Setting(containerEl)
      .setName(t('pgn.enable'))
      .setDesc(t('pgn.enable.desc'))
      .addToggle(toggle =>
        toggle.setValue(settings.enablePGNView).onChange(value => {
          settings.enablePGNView = value;
          void this.plugin.saveSettings();
        }),
      );

    const pgnExtSetting = new Setting(containerEl)
      .setName(t('pgn.extensions'))
      .setDesc(t('pgn.extensions.desc') + ' (默认: pgn)')
      .addText(text =>
        text.setValue(settings.pgnFileExtensions.join(', ')).onChange(value => {
          settings.pgnFileExtensions = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          void this.plugin.saveSettings();
        }),
      )
      .addButton(button =>
        button.setIcon('rotate-ccw').onClick(() => {
          settings.pgnFileExtensions = ['pgn'];
          pgnExtSetting.controlEl.querySelector('input')!.value = 'pgn';
          void this.plugin.saveSettings();
        }),
      );

    containerEl.parentElement?.classList.add('ws-setting-tab');
  }

  async hide() {
    this.plugin.refresh();
    void this.plugin.saveSettings();
  }
}
