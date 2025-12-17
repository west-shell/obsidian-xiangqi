import { registerPGNViewModule } from '../../core/module-system';
import TreeView from '../../lib/Tree/Xiangqi.svelte';
import { mount, unmount } from "svelte";

const TreeViewModule = {
    init(host: Record<string, any>) {
        const eventBus = host.eventBus;

        eventBus.on('createUI', () => {

            const Container = host.contentEl;
            Container.classList.add('pgn-view');
            host.Xiangqi = mount(TreeView, {
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
                settings: { ...host.settings },
                nodeMap: new Map(host.nodeMap),
                board: host.currentNode.board,
                markedPos: host.markedPos,
                currentTurn: host.currentTurn,
                currentNode: host.currentNode,
                currentPath: host.currentPath,
            });
        })

        eventBus.on('ready', () => {
            if (!host.settings.autoJump) return
            switch (host.settings.autoJump) {
                case "never":
                    break;
                case "always":
                    eventBus.emit('btn-click', { name: 'toEnd' });
                    break;
                case "auto":
                    if (!host.haveFEN) {
                        eventBus.emit('btn-click', { name: 'toEnd' });
                    }
                    break;
            }
        })

        eventBus.on("unload", () => {
            unmount(host.Xiangqi)
        })

    }
}

registerPGNViewModule('Tree', TreeViewModule);