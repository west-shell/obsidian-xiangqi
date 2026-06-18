import '../core/event-bus';
import '../modules/Source/Source';
import '../modules/BoardClick';
import '../modules/Tree/ChessBoard';
// import '../modules/Tree/PGNView';
import '../modules/Tree/Actions';

import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';

import type { EventBus } from '../core/event-bus';
import { createTreeModuleRegistry } from '../core/module-system';
import type ChessPlugin from '../main';
import type { ISettings } from '../types';

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
    // this.contentEl = containerEl;
    containerEl.classList.add('tree-codeblock');
    createTreeModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    const h = this.settings.cellSize * 11;
    document.body.style.setProperty('--tree-hight', `${h}px`);
    this.eventBus.emit('load', 'tree');
    this.eventBus.emit('creatUI');
  }

  refresh(): void {
    const h = this.settings.cellSize * 11;
    document.body.style.setProperty('--tree-hight', `${h}px`);
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
    // destroyTreeModuleRegistry(this);
  }
}
