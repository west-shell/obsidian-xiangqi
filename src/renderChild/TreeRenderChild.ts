import '../core/event-bus';
import '../modules/Tree/TreeMap';
import '../modules/Tree/TreeView';
import '../modules/BoardClick';
import '../modules/Tree/Actions';

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
    (this as any).contentEl = containerEl;
    containerEl.classList.add('tree-codeblock');
    createPGNViewModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    (this as any).data = this.source;
    this.eventBus.emit('setViewData');
    this.eventBus.emit('createUI');

    // 撑满代码块容器：计算视口剩余高度
    requestAnimationFrame(() => {
      const rect = this.containerEl.getBoundingClientRect();
      const top = rect.top;
      const bottomGap = 20;
      const h = window.innerHeight - top - bottomGap;
      if (h > 300) this.containerEl.style.height = h + 'px';
    });
  }

  refresh(): void {
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
  }
}
