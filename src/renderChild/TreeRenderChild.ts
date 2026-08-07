import "../core/event-bus";
import "../modules/Source/Source";
import "../modules/BoardClick";
import "../modules/Tree/ChessBoard";
import "../modules/Tree/Actions";
import "../modules/Engine/EngineModule";

import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from "obsidian";

import type { EventBus } from "../core/event-bus";
import { createTreeModuleRegistry } from "../core/module-system";
import type ChessPlugin from "../main";
import type { ISettings } from "../types";

export class TreeRenderChild extends MarkdownRenderChild {
  settings: ISettings;
  eventBus!: EventBus;
  constructor(
    public containerEl: HTMLElement,
    public ctx: MarkdownPostProcessorContext,
    public source: string,
    public plugin: ChessPlugin,
  ) {
    super(containerEl);
    this.settings = this.plugin.settings;
    containerEl.classList.add("tree-codeblock");
    createTreeModuleRegistry(this);
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
    this.eventBus.emit("creatUI");
  }

  refresh(): void {
    this.eventBus.emit("updateUI");
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit("unload");
  }
}
