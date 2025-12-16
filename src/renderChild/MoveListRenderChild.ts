import XQPlugin from '../main';
import {
    type MarkdownPostProcessorContext,
    MarkdownRenderChild,
} from 'obsidian';
import {
    createXQModuleRegistry
} from '../core/module-system';
import type { EventBus } from '../core/event-bus';
import type { ISettings } from '../types';
import '../core/event-bus';
import '../modules/Source';
import '../modules/MoveList/ChessBoard';
import '../modules/BoardClick';
import '../modules/MoveList/History';
import '../modules/MoveList/Actions';
import '../modules/MoveList/Speaker';

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
        createXQModuleRegistry(this);
    }

    onload(): void {
        this.plugin.instances.add(this);
        this.eventBus.emit('load', 'xq');
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