import XQPlugin from '../main';
import {
    type MarkdownPostProcessorContext,
    MarkdownRenderChild,
} from 'obsidian';
import {
    type ModuleRegistry,
    createGenFENModuleRegistry,
    destroyGenFENModuleRegistry
} from '../core/module-system';
import type { EventBus } from '../core/event-bus';
import type { ISettings } from '../types';
import '../core/event-bus';
import '../modules/Source';
import '../modules/GenFEN/FENBoard';
import '../modules/GenFEN/BoardClick';
import '../modules/GenFEN/Actions';

export class GenFENRenderChild extends MarkdownRenderChild {
    settings: ISettings;
    moduleRegistry: ModuleRegistry | undefined;
    eventBus!: EventBus;
    constructor(
        public containerEl: HTMLElement,
        public ctx: MarkdownPostProcessorContext,
        public source: string,
        public plugin: XQPlugin,
    ) {
        super(containerEl);
        this.settings = this.plugin.settings;
        createGenFENModuleRegistry(this);
    }

    onload(): void {
        this.plugin.instances.add(this);
        this.eventBus.emit('load', 'fen');
    }

    refresh(): void {
        this.eventBus.emit('updateUI');
    }

    onunload(): void {
        this.plugin.instances.delete(this);
        this.eventBus.emit('unload');
    }

}