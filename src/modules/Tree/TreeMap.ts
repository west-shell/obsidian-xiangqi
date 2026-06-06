import { PGNParser } from './parser';
import { registerPGNViewModule } from '../../core/module-system';

const TreeMap = {
    init(host: Record<string, unknown>) {
        const eventBus = host.eventBus;

        host.updateMainPath = function updateMainPath() {
            const { currentNode, nodeMap } = host;
            if (!currentNode) {
                host.currentPath = [];
                return;
            }
            const ancestors: string[] = [];
            let node = currentNode;
            while (node) {
                ancestors.push(node.id);
                node = node.parentID ? nodeMap.get(node.parentID) : null;
            }
            ancestors.reverse();
            const descendants: string[] = [];
            node = currentNode.children?.[0] || null;
            while (node) {
                descendants.push(node.id);
                node = node.children?.[0] || null;
            }
            host.currentPath = [...ancestors, ...descendants];
        };

        eventBus.on('setViewData', () => {
            host.markedPos = null;
            const parser = new PGNParser(host.data);
            host.parser = parser;
            host.haveFEN = parser.haveFEN;
            host.root = parser.getRoot();
            host.nodeMap = parser.getMap();
            host.tags = parser.getTags();
            host.currentNode = host.nodeMap.get('node-root');
            host.currentTurn = 'red';
            host.updateMainPath();
        });
    }
};

registerPGNViewModule('treemap', TreeMap);
