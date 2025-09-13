import XQPlugin from '../main';
import {
    type MarkdownPostProcessorContext,
    MarkdownRenderChild,
} from 'obsidian';
import {
    createXQModuleRegistry,
    destroyXQModuleRegistry
} from '../core/module-system';
import type { EventBus } from '../core/event-bus';
import type { ISettings } from '../types';
import '../core/event-bus';
import '../modules/Xiangqi/Source';
import '../modules/Xiangqi/ChessBoard';
import '../modules/Xiangqi/BoardClick';
import '../modules/Xiangqi/History';
import '../modules/Xiangqi/Actions';
import '../modules/Xiangqi/Speaker';

export class ChessRenderChild extends MarkdownRenderChild {
    settings: ISettings;
    eventBus!: EventBus;
    constructor(
        public containerEl: HTMLElement,
        public ctx: MarkdownPostProcessorContext,
        public source: string,
        public plugin: XQPlugin,
    ) {
        super(containerEl);
        this.settings = this.plugin.settings;
    }

    onload(): void {
        this.plugin.renderChildren.add(this);
        createXQModuleRegistry(this);
        this.eventBus.emit('load', 'xq');
    }

    refresh(): void {
        this.eventBus.emit('updateUI');
    }

    onunload(): void {
        this.plugin.renderChildren.delete(this);
        this.eventBus.emit('unload');
        destroyXQModuleRegistry(this);
    }

}