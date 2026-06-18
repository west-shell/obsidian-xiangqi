import './style/base.css';
import './style/board.css';
import './style/pieces.css';

import { addIcon, MarkdownView, Plugin, TFile } from 'obsidian';

import { initI18n, t } from './i18n';
import { GenFENRenderChild } from './renderChild/GenFENRenderChild';
import { ChessRenderChild } from './renderChild/ListRenderChild';
import { TreeRenderChild } from './renderChild/TreeRenderChild';
import { ChessSettingTab, DEFAULT_SETTINGS } from './settings';
import { applyThemes } from './themes';
import type { ISettings } from './types';
import { PGNView } from './view/PGNView';

export default class ChessPlugin extends Plugin {
  settings: ISettings = DEFAULT_SETTINGS;
  instances: Set<{ refresh(): void }> = new Set();
  async onload() {
    await this.loadSettings();
    initI18n(this.settings.lang);

    this.addSettingTab(new ChessSettingTab(this.app, this));

    applyThemes(this.app, this.settings);

    addIcon(
      'xiangqi-icon',
      `
<svg viewBox="0 0 80 80">
  <circle cx="40" cy="40" r="38"
    fill="var(--background-primary-alt)"
    stroke="var(--text-normal)"
    stroke-width="4" />
  <text x="50%" y="58%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="60"
    fill="var(--text-normal)"
    font-weight="bold">象</text>
</svg>
`,
    );

    this.registerCodeBlocks();

    if (this.settings.enablePGNView) {
      this.registerView(PGNView.VIEW_TYPE, leaf => new PGNView(leaf, this));
      this.registerExtensions(this.settings.pgnFileExtensions, PGNView.VIEW_TYPE);

      this.addRibbonIcon('xiangqi-icon', t('pgn.newFile'), async () => {
        let baseFileName = '未命名';
        let fileExtension = `.${this.settings.pgnFileExtensions[0] ?? 'pgn'}`;
        let fileName = baseFileName + fileExtension;
        let counter = 0;

        while (await this.app.vault.adapter.exists(fileName)) {
          counter++;
          fileName = `${baseFileName} ${counter}${fileExtension}`;
        }

        const fileContent = '';

        try {
          const newFile = await this.app.vault.create(fileName, fileContent);
          this.app.workspace.getLeaf(true).openFile(newFile);
        } catch (error) {
          console.error(t('pgn.error'), error);
        }
      });

      this.registerEvent(
        this.app.workspace.on('file-menu', (menu, file) => {
          if (!(file instanceof TFile) || !this.settings.pgnFileExtensions.includes(file.extension)) {
            return;
          }
          const currentView = this.app.workspace.getLeaf().view;
          if (!(currentView instanceof MarkdownView && currentView.file === file)) {
            menu.addItem(item =>
              item
                .setTitle(t('menu.markdown'))
                .setIcon('file-text')
                .onClick(() => this.changeView(file, 'markdown')),
            );
          }
          if (!(currentView instanceof PGNView && currentView.file === file)) {
            menu.addItem(item =>
              item
                .setTitle(t('menu.pgn'))
                .setIcon('xiangqi-icon')
                .onClick(() => this.changeView(file, PGNView.VIEW_TYPE)),
            );
          }
        }),
      );
    }

    this.registerEvent(
      this.app.workspace.on('resize', () => {
        (activeDocument ?? document).body.dispatchEvent(new CustomEvent('xq-layout-change'));
      }),
    );

    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        applyThemes(this.app, this.settings);
      }),
    );
  }

  refresh() {
    this.instances.forEach(instance => {
      instance.refresh();
    });
  }

  registerCodeBlocks() {
    const { codeBlockNames } = this.settings;

    for (const name of codeBlockNames.xiangqi) {
      this.registerMarkdownCodeBlockProcessor(name, (source, el, ctx) => {
        ctx.addChild(new ChessRenderChild(el, ctx, source, this));
      });
    }

    for (const name of codeBlockNames.xq) {
      this.registerMarkdownCodeBlockProcessor(name, (source, el, ctx) => {
        ctx.addChild(new GenFENRenderChild(el, ctx, source, this));
      });
    }

    for (const name of codeBlockNames.tree) {
      this.registerMarkdownCodeBlockProcessor(name, (source, el, ctx) => {
        ctx.addChild(new TreeRenderChild(el, ctx, source, this));
      });
    }
  }

  async changeView(file: TFile, targetViewType: string) {
    const leaf = this.app.workspace.getLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({
      type: targetViewType,
      state: { file: file.path },
      active: true,
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
    applyThemes(this.app, this.settings);
  }
}
