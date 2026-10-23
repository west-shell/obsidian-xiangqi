import { Scope, TextFileView, type WorkspaceLeaf } from "obsidian";

import { EventBus } from "../core/event-bus";
import {
  type ChessModule,
  destroyModules,
  initModules,
  type ModuleInstance,
} from "../core/module-system";
import type ChessPlugin from "../main";
import { RIBBON_ICON } from "../chess";
import type { ISettings } from "../types";
import { NAV_ACTIONS } from "../utils/nav-actions";
import { BoardClickModule } from "../modules/BoardClick";
import { EngineModule } from "../modules/Engine/EngineModule";
import { ActionsModule } from "../modules/Actions";
import { BranchNavModule } from "../modules/Navigate/BranchNav";
import { EditFenModule } from "../modules/Edit/EditFen";
import { EditTagsModule } from "../modules/Edit/EditTags";
import { EngineSettingsModule } from "../modules/Engine/EngineSettings";
import { FileHostModule } from "../modules/Hosts/FileHost";
import { GameSlotsModule } from "../modules/GameSlots";
import { ImportExportModule } from "../modules/ImportExport";
import { NavigateModule } from "../modules/Navigate";
import { SpeakerModule } from "../modules/Speak";
import { TreeEditModule } from "../modules/Edit/TreeEdit";

/**
 * Ordered module list for the PGN file view. The EventBus must come
 * first — every other module reads `host.eventBus` in its init.
 */
const FILE_MODULES: ChessModule[] = [
  EventBus,
  BoardClickModule,
  FileHostModule,
  ActionsModule,
  NavigateModule,
  BranchNavModule,
  TreeEditModule,
  GameSlotsModule,
  EditFenModule,
  EditTagsModule,
  ImportExportModule,
  EngineSettingsModule,
  SpeakerModule,
  EngineModule,
];

export class FileHost extends TextFileView {
  static readonly VIEW_TYPE = "PGN_VIEW";
  settings: ISettings;
  eventBus!: EventBus;
  generation = 0;
  pathChoices = new Map<string, number>();
  private moduleInstances: ModuleInstance[] = [];
  constructor(
    leaf: WorkspaceLeaf,
    public plugin: ChessPlugin,
  ) {
    super(leaf);
    this.settings = this.plugin.settings;
    this.data = "";
    this.moduleInstances = initModules(this, FILE_MODULES);
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
    // The modifier-combo defaults (Ctrl / Ctrl+Alt+Shift / Alt /
    // Alt+Shift / Ctrl+Shift + arrows) live on this Scope too — they
    // only apply while the PGN view is active, so no global hotkey is
    // preset (commands ship without defaults; users can still assign
    // their own in Settings → Hotkeys).
    for (const { action, hotkeys } of NAV_ACTIONS) {
      for (const { modifiers, key } of hotkeys ?? []) {
        this.scope.register(modifiers, key, () => {
          if (isEditing()) return true;
          this.eventBus.emit("btn-click", { name: action });
          return false;
        });
      }
    }
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

  getDisplayText(): string {
    if (this.file) {
      return this.file.basename;
    }
    return "Pgn view";
  }

  getIcon() {
    return RIBBON_ICON;
  }

  clear(): void {
    destroyModules(this.moduleInstances);
    this.moduleInstances = [];
  }
}
