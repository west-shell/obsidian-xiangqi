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
    // TreeView 等模块取 host.contentEl（PGNView 由 TextFileView 提供）
    (this as any).contentEl = containerEl;
    // 给代码块容器一点高度，防止树塌缩
    containerEl.style.minHeight = '300px';
    containerEl.style.overflow = 'hidden';
    createPGNViewModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    // 直接触发 TreeMap 解析和 TreeView 挂载，不走 Source.ts
    (this as any).data = this.source;
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
