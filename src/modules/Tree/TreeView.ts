import { registerPGNViewModule } from '../../core/module-system';
import TreeView from '../../lib/Tree/TreeView.svelte';

class TreeViewModule {
    static init(host: Record<string, any>) {
        host.TreeViewModule = new TreeViewModule(host);
    }
    constructor(host: Record<string, any>) {
        const eventBus = host.eventBus;
        eventBus.on('createUI', () => {

            const Container = host.contentEl;
            host.Xiangqi = new TreeView({
                target: Container,
                props: {
                    nodeMap: host.nodeMap,
                    settings: host.settings,
                    board: host.currentNode.board,
                    markedPos: host.markedPos,
                    currentTurn: host.currentTurn,
                    eventBus: host.eventBus,
                    currentNode: host.currentNode,
                    currentPath: host.currentPath,
                }
            })
        })
        eventBus.on("updateUI", () => {

            host.Xiangqi.$set({
                settings: host.settings,
                nodeMap: host.nodeMap,
                board: host.currentNode.board,
                markedPos: host.markedPos,
                currentTurn: host.currentTurn,
                currentNode: host.currentNode,
                currentPath: host.currentPath,
            });
        })

    }
}

registerPGNViewModule('Tree', TreeViewModule);