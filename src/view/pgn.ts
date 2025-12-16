import XQPlugin from '../main';
import type { ISettings } from '../types';
import { TextFileView, type WorkspaceLeaf } from 'obsidian';
import {
    createPGNViewModuleRegistry,
    destroyPGNViewModuleRegistry
} from '../core/module-system';
import { EventBus } from '../core/event-bus';
import '../core/event-bus';
import '../modules/Tree/TreeMap'
import '../modules/Tree/TreeView'
import '../modules/BoardClick'
import '../modules/Tree/Actions'

export class PGNView extends TextFileView {
    static readonly VIEW_TYPE = "PGN_VIEW";
    settings: ISettings;
    eventBus!: EventBus;
    constructor(leaf: WorkspaceLeaf, public plugin: XQPlugin) {
        super(leaf);
        this.settings = this.plugin.settings;
        this.data = '';
        createPGNViewModuleRegistry(this)
    }

    setViewData(data: string, clear: boolean = true): void {
        this.contentEl.empty();
        this.data = data;
        this.eventBus.emit('setViewData');
        this.eventBus.emit('createUI');
    }

    saveFile() {
        if (this.file) {
            this.app.vault.modify(this.file, this.data);
        }
    }

    async onOpen() {
        await super.onOpen();
        this.plugin.instances.add(this)
        this.contentEl.empty()
    }

    refresh() {
        this.eventBus.emit('updateUI')
    }
    protected async onClose(): Promise<void> {
        this.eventBus.emit("unload");
        this.plugin.instances.delete(this)
        return super.onClose()
    }
    getViewType() { return PGNView.VIEW_TYPE; }

    getViewData(): string {
        return this.data
    }

    getDisplayText() {
        if (this.file) {
            return this.file!.basename
        }
        return "Pgn view";
    }

    getIcon() {
        return "xiangqi-icon";
    }

    clear(): void {
        destroyPGNViewModuleRegistry(this)
    }
}
