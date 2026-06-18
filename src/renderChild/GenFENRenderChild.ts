import '../core/event-bus';
import '../modules/Source/Source';
import '../modules/GenFEN/FENBoard';
import '../modules/GenFEN/BoardClick';
import '../modules/GenFEN/Actions';

import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';

import type { EventBus } from '../core/event-bus';
import { createGenFENModuleRegistry, type ModuleRegistry } from '../core/module-system';
import type ChessPlugin from '../main';
import type { ISettings } from '../types';

export class GenFENRenderChild extends MarkdownRenderChild {
  settings: ISettings;
  moduleRegistry: ModuleRegistry | undefined;
  eventBus!: EventBus;
  constructor(
    public containerEl: HTMLElement,
    public ctx: MarkdownPostProcessorContext,
    public source: string,
    public plugin: ChessPlugin,
  ) {
    super(containerEl);
    this.settings = this.plugin.settings;
    createGenFENModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    this.eventBus.emit('load', 'fen');
    this.eventBus.emit('creatUI');
  }

  refresh(): void {
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
  }
}
