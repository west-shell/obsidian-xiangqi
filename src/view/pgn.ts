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
import '../modules/Xiangqi/BoardClick'
import '../modules/Tree/Actions'


export class PGNView extends TextFileView {
    static readonly VIEW_TYPE = "PGN_FILE_TYPE";
    settings: ISettings;
    eventBus!: EventBus;
    constructor(leaf: WorkspaceLeaf, public plugin: XQPlugin) {
        super(leaf);
        this.settings = this.plugin.settings;
        this.data = '';
        createPGNViewModuleRegistry(this)
    }

    setViewData(data: string, clear: boolean = true): void {
        this.data = data;
        this.eventBus.emit('setViewData');
        this.eventBus.emit('createUI');
    }

    saveFile() {
        if (this.file) {
            this.app.vault.process(this.file, () => this.data);
        }
    }

    async onOpen() {
        await super.onOpen();
        this.plugin.renderChildren.add(this)
        this.contentEl.empty()
    }

    refresh() {
        this.eventBus.emit('updateUI')
    }
    protected async onClose(): Promise<void> {
        this.plugin.renderChildren.delete(this)
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
        return "dice"; // 换成你喜欢的 Obsidian 图标
    }

    clear(): void {
        destroyPGNViewModuleRegistry(this)
    }
}
