import '../core/event-bus';
import '../modules/Source/Source';
import '../modules/BoardClick';
import '../modules/List/ChessBoard';
import '../modules/List/History';
import '../modules/List/Actions';
import '../modules/List/Speak';

import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';

import type { EventBus } from '../core/event-bus';
import { createXQModuleRegistry } from '../core/module-system';
import type ChessPlugin from '../main';
import type { ISettings } from '../types';

export class ChessRenderChild extends MarkdownRenderChild {
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
    createXQModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    this.eventBus.emit('load', 'list');
    this.eventBus.emit('creatUI');
  }

  refresh(): void {
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
    // destroyXQModuleRegistry(this);
  }
}
