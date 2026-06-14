import '../core/event-bus';
import '../modules/Tree/TreeMap';
import '../modules/Tree/TreeView';
import '../modules/BoardClick';
import '../modules/Tree/Actions';
import '../modules/Tree/Speaker';

import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';

import type { EventBus } from '../core/event-bus';
import { createPGNViewModuleRegistry } from '../core/module-system';
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
    createPGNViewModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    this.eventBus.emit('load', 'pgn');
    this.eventBus.emit('setViewData');
    this.eventBus.emit('createUI');
  }

  refresh(): void {
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
  }
}
