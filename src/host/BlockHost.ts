import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from "obsidian";

import { EventBus } from "../core/event-bus";
import {
  type ChessModule,
  destroyModules,
  initModules,
  type ModuleInstance,
} from "../core/module-system";
import { CLS_PREFIX } from "../chess";
import type ChessPlugin from "../main";
import type { ISettings } from "../types";
import { BoardClickModule } from "../modules/BoardClick";
import { EngineModule } from "../modules/Engine/EngineModule";
import { KeyboardNavModule } from "../modules/KeyboardNav";
import { SourceModule } from "../modules/Source/Source";
import { ActionsModule } from "../modules/Actions";
import { BlockHostModule } from "../modules/Hosts/BlockHost";
import { BranchNavModule } from "../modules/Navigate/BranchNav";
import { EditFenModule } from "../modules/Edit/EditFen";
import { EditTagsModule } from "../modules/Edit/EditTags";
import { EngineSettingsModule } from "../modules/Engine/EngineSettings";
import { GameSlotsModule } from "../modules/GameSlots";
import { ImportExportModule } from "../modules/ImportExport";
import { NavigateModule } from "../modules/Navigate";
import { TreeEditModule } from "../modules/Edit/TreeEdit";

/**
 * Ordered module list for code-block views. The EventBus must come
 * first — every other module reads `host.eventBus` in its init.
 */
const BLOCK_MODULES: ChessModule[] = [
  EventBus,
  BoardClickModule,
  SourceModule,
  BlockHostModule,
  ActionsModule,
  NavigateModule,
  BranchNavModule,
  TreeEditModule,
  GameSlotsModule,
  EditFenModule,
  EditTagsModule,
  ImportExportModule,
  EngineSettingsModule,
  KeyboardNavModule,
  EngineModule,
];

export class BlockHost extends MarkdownRenderChild {
  settings: ISettings;
  eventBus!: EventBus;
  generation = 0;
  pathChoices = new Map<string, number>();
  private moduleInstances: ModuleInstance[] = [];
  constructor(
    public containerEl: HTMLElement,
    public ctx: MarkdownPostProcessorContext,
    public source: string,
    public plugin: ChessPlugin,
  ) {
    super(containerEl);
    this.settings = this.plugin.settings;
    containerEl.classList.add(`${CLS_PREFIX}-block`);
    this.moduleInstances = initModules(this, BLOCK_MODULES);
  }

  onload(): void {
    this.plugin.instances.add(this);
    const section = this.ctx.getSectionInfo(this.containerEl);
    let isFenBlock = false;
    if (section) {
      const line = section.text.split("\n")[section.lineStart];
      const match = line?.match(/^```(\S+)/);
      if (match) {
        isFenBlock = this.plugin.settings.fenBlockNames.includes(match[1]);
      }
    }
    this.eventBus.emit("load", isFenBlock ? "fen" : "tree");
    this.eventBus.emit("createUI");
  }

  refresh(): void {
    this.eventBus.emit("updateUI");
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit("unload");
    destroyModules(this.moduleInstances);
    this.moduleInstances = [];
  }
}
