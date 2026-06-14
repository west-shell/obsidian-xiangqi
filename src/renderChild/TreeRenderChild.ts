import '../core/event-bus';
import '../modules/Tree/TreeMap';
import '../modules/Tree/TreeView';
import '../modules/BoardClick';
import '../modules/Tree/Actions';

import { type MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView } from 'obsidian';

import type { EventBus } from '../core/event-bus';
import { createTreeModuleRegistry, destroyTreeModuleRegistry } from '../core/module-system';
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
    createTreeModuleRegistry(this);
  }

  saveFile = () => {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return;
    const newContent = (this as any).data as string;

    this.plugin.app.vault.process(view.file, fileContent => {
      const section = this.ctx.getSectionInfo(this.containerEl);
      if (!section) return fileContent;

      const { lineStart, lineEnd } = section;
      const lines = fileContent.split('\n');
      const blockLines = lines.slice(lineStart, lineEnd + 1);

      if (blockLines.length < 2) return fileContent;

      const updated = [blockLines[0], newContent, blockLines[blockLines.length - 1]];
      const newLines = [...lines.slice(0, lineStart), ...updated, ...lines.slice(lineEnd + 1)];
      return newLines.join('\n');
    });
  };

  onload(): void {
    this.plugin.instances.add(this);
    (this as any).data = this.source;
    this.eventBus.emit('setViewData');
    this.eventBus.emit('createUI');
    const h = this.settings.cellSize * 11;
    document.body.style.setProperty('--tree-hight', `${h}px`);
  }

  refresh(): void {
    const h = this.settings.cellSize * 11;
    document.body.style.setProperty('--tree-hight', `${h}px`);
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
    destroyTreeModuleRegistry(this);
  }
}
