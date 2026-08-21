import "./css-imports";

import { MarkdownView, Plugin, TFile } from "obsidian";

import { initI18n, t } from "./i18n";
import { TreeRenderChild } from "./renderChild/TreeRenderChild";
import { ChessSettingTab, DEFAULT_SETTINGS } from "./settings";
import { applyThemes } from "./themes";
import type { ISettings } from "./types";
import { PGNView } from "./view/PGNView";
import {
  DEFAULT_FILENAME,
  LAYOUT_CHANGE_EVENT,
  RIBBON_ICON,
  ZOOM_CHANGE_EVENT,
} from "./chess";

export default class ChessPlugin extends Plugin {
  settings: ISettings = DEFAULT_SETTINGS;
  instances: Set<{ refresh(): void }> = new Set();
  async onload() {
    await this.loadSettings();

    initI18n(this.settings.lang);

    this.addSettingTab(new ChessSettingTab(this.app, this));

    applyThemes(this.settings);

    this.registerCodeBlocks();

    if (this.settings.enablePGNView) {
      this.registerView(PGNView.VIEW_TYPE, (leaf) => new PGNView(leaf, this));
      this.registerExtensions(
        this.settings.pgnFileExtensions,
        PGNView.VIEW_TYPE,
      );

      this.addRibbonIcon(RIBBON_ICON, t("pgn.newFile"), async () => {
        let baseFileName = DEFAULT_FILENAME;
        let fileExtension = `.${this.settings.pgnFileExtensions[0] ?? "pgn"}`;
        let fileName = baseFileName + fileExtension;
        let counter = 0;

        while (await this.app.vault.adapter.exists(fileName)) {
          counter++;
          fileName = `${baseFileName} ${counter}${fileExtension}`;
        }

        const fileContent = "";

        try {
          const newFile = await this.app.vault.create(fileName, fileContent);
          void this.app.workspace.getLeaf(true).openFile(newFile);
        } catch (error) {
          console.error(t("pgn.error"), error);
        }
      });

      this.registerEvent(
        this.app.workspace.on("file-menu", (menu, file) => {
          if (
            !(file instanceof TFile) ||
            !this.settings.pgnFileExtensions.includes(file.extension)
          ) {
            return;
          }
          const currentView = this.app.workspace.getLeaf().view;
          if (!(
            currentView instanceof MarkdownView && currentView.file === file
          )) {
            menu.addItem((item) =>
              item
                .setTitle(t("menu.markdown"))
                .setIcon("file-text")
                .onClick(() => this.changeView(file, "markdown")),
            );
          }
          if (!(currentView instanceof PGNView && currentView.file === file)) {
            menu.addItem((item) =>
              item
                .setTitle(t("menu.pgn"))
                .setIcon(RIBBON_ICON)
                .onClick(() => this.changeView(file, PGNView.VIEW_TYPE)),
            );
          }
        }),
      );
    }

    this.registerEvent(
      this.app.workspace.on("resize", () => {
        activeDocument.body.dispatchEvent(new CustomEvent(LAYOUT_CHANGE_EVENT));
      }),
    );

    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        applyThemes(this.settings);
      }),
    );

    const onZoomChanged = (e: Event) => {
      this.settings.zoom = (e as CustomEvent<number>).detail;
      void this.saveSettings();
    };
    activeDocument.body.addEventListener(ZOOM_CHANGE_EVENT, onZoomChanged);
    this.register(() => {
      activeDocument.body.removeEventListener(ZOOM_CHANGE_EVENT, onZoomChanged);
    });
  }

  refresh() {
    applyThemes(this.settings);
    this.instances.forEach((instance) => {
      instance.refresh();
    });
  }

  registerCodeBlocks() {
    const { treeBlockNames, fenBlockNames } = this.settings;
    const allBlockNames = [...new Set([...treeBlockNames, ...fenBlockNames])];

    for (const name of allBlockNames) {
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

  onunload() {
    void this.saveSettings();
  }

  async loadSettings() {
    const savedData = (await this.loadData()) as Record<string, unknown> | null;
    if (savedData) {
      const picked: Record<string, unknown> = {};
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (key in savedData) {
          picked[key] = savedData[key];
        }
      }
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...(picked as Partial<ISettings>),
      };
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    applyThemes(this.settings);
  }
}
