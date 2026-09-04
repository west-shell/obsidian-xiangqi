import "../core/event-bus";
import "../modules/BoardClick";
import "../modules/Tree/FileHost";
import "../modules/Tree/Actions";
import "../modules/Tree/Speak";
import "../modules/Engine/EngineModule";

import { Scope, TextFileView, type WorkspaceLeaf } from "obsidian";

import { type EventBus } from "../core/event-bus";
import {
  createFileModuleRegistry,
  destroyFileModuleRegistry,
} from "../core/module-system";
import type ChessPlugin from "../main";
import { RIBBON_ICON } from "../chess";
import type { ISettings } from "../types";

export class FileHost extends TextFileView {
  static readonly VIEW_TYPE = "PGN_VIEW";
  settings: ISettings;
  eventBus!: EventBus;
  generation = 0;
  constructor(
    leaf: WorkspaceLeaf,
    public plugin: ChessPlugin,
  ) {
    super(leaf);
    this.settings = this.plugin.settings;
    this.data = "";
    createFileModuleRegistry(this);
  }

  setViewData(data: string, clear: boolean = true): void {
    this.contentEl.empty();
    this.data = data;
    this.eventBus.emit("setViewData");
    this.eventBus.emit("createUI");
  }

  saveFile() {
    if (this.file) {
      void this.app.vault.modify(this.file, this.data);
    }
  }

  async onOpen() {
    await super.onOpen();
    this.plugin.instances.add(this);
    this.contentEl.empty();

    this.scope = new Scope(this.app.scope);
    const isEditing = (): boolean => {
      const el = document.activeElement;
      return (
        (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) &&
        this.contentEl.contains(el)
      );
    };
    this.scope.register([], "ArrowUp", () => {
      if (isEditing()) return true;
      this.eventBus.emit("btn-click", { name: "back" });
      return false;
    });
    this.scope.register([], "ArrowDown", () => {
      if (isEditing()) return true;
      this.eventBus.emit("btn-click", { name: "next" });
      return false;
    });
    this.scope.register([], "ArrowLeft", () => {
      if (isEditing()) return true;
      this.eventBus.emit("btn-click", { name: "toStart" });
      return false;
    });
    this.scope.register([], "ArrowRight", () => {
      if (isEditing()) return true;
      this.eventBus.emit("btn-click", { name: "toEnd" });
      return false;
    });
  }

  refresh() {
    this.eventBus.emit("updateUI");
  }
  protected async onClose(): Promise<void> {
    this.eventBus.emit("unload");
    this.plugin.instances.delete(this);
    return super.onClose();
  }
  getViewType() {
    return FileHost.VIEW_TYPE;
  }

  getViewData(): string {
    return this.data;
  }

  getDisplayText() {
    if (this.file) {
      return this.file.basename;
    }
    return "Pgn view";
  }

  getIcon() {
    return RIBBON_ICON;
  }

  clear(): void {
    destroyFileModuleRegistry(this);
  }
}
