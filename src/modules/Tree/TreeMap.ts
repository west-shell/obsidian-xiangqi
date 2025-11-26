import { PGNParser } from './parser';
import { registerPGNViewModule } from '../../core/module-system';

const TreeMap = {
    init(host: any) {
        const eventBus = host.eventBus;

        // 更新主线路径函数
        host.updateMainPath = function updateMainPath() {
            const { currentNode, nodeMap } = host;
            if (!currentNode) {
                host.currentPath = [];
                return;
            }

            // 先向上遍历收集祖先节点（包括当前节点）
            const ancestors: string[] = [];
            let node = currentNode;
            while (node) {
                ancestors.push(node.id);
                node = node.parentID ? nodeMap.get(node.parentID) : null;
            }
            ancestors.reverse(); // 反转为根到当前节点顺序

            // 向下遍历主线子节点（跳过当前节点）
            const descendants: string[] = [];
            node = currentNode.children?.[0] || null;
            while (node) {
                descendants.push(node.id);
                node = node.children?.[0] || null;
            }

            // 合并路径
            host.currentPath = [...ancestors, ...descendants];
        };


        eventBus.on('setViewData', () => {
            const parser = new PGNParser(host.data);
            host.parser = parser;
            host.root = parser.getRoot();
            host.nodeMap = parser.getMap();
            host.tags = parser.getTags();
            host.currentNode = host.nodeMap.get('node-root');
            host.currentTurn = host.currentNode.side === 'black' ? 'black' : 'red';
            host.board = host.currentNode.board;
            host.updateMainPath();
        });
    }
};

registerPGNViewModule('treemap', TreeMap);
