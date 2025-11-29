import { registerPGNViewModule } from "../../core/module-system";
import type { ChessNode, IMove } from "../../types";
import { getICCS, genFENFromBoard } from "../../utils/parse";

const ActionsModule = {
    init(host: Record<string, any>) {
        const eventBus = host.eventBus;

        eventBus.on('runmove', (move: IMove) => {
            const { from, to } = move
            const currentNode = host.currentNode;
            for (let node of currentNode.children) {
                if (node.data && node.data.from.x === from.x && node.data.from.y === from.y && node.data.to.x === to.x && node.data.to.y === to.y) {
                    host.currentNode = node;
                    host.board = host.currentNode.board;
                    host.currentTurn = host.currentTurn === 'red' ? 'black' : 'red';
                    host.updateMainPath();
                    eventBus.emit('updateUI')
                    return;
                }
            }
            const piece = host.currentNode.board![move.from.x][move.from.y];
            move.type = piece;
            move.ICCS = getICCS(move);
            host.nodeId = host.parser.nodeId
            const newNode: ChessNode = {
                id: `node-${host.parser.nodeId++}`,
                data: move,
                step: host.currentStep,
                side: host.currentTurn,
                parentID: host.currentNode.id,
                children: [],
                mainID: null,
                comments: []
            };
            host.nodeMap.set(newNode.id, newNode);
            const newboard = host.currentNode.board!.map((row: string | null[]) => row.slice());
            newboard[move.from.x][move.from.y] = null; // 清除原位置
            if (newboard[move.to.x][move.to.y]) {
                move.captured = newboard[move.to.x][move.to.y]; // 记录被吃掉的棋子
            }
            newboard[move.to.x][move.to.y] = piece; // 设置新位置
            newNode.board = newboard;
            host.board = newboard;
            host.currentNode.children.push(newNode);
            host.currentNode = newNode;
            host.currentTurn = host.currentTurn === 'red' ? 'black' : 'red';
            host.currentStep++;
            host.updateMainPath();
            eventBus.emit('updateUI')
            eventBus.emit('updatePGN')
        })
        eventBus.on('node-click', (id: string) => {
            host.markedPos = null;
            host.currentNode = host.nodeMap.get(id);
            host.board = host.currentNode.board;
            host.currentTurn = host.currentNode.side === 'red' ? 'black' : 'red';
            host.updateMainPath();
            host.eventBus.emit('updateUI')
        })

        eventBus.on('updatePGN', () => {
            const pgn = stringifyPGN(host.root);
            const content = [host.tags?.trim(), pgn]
                .filter(Boolean)
                .join('\n');
            host.data = content;
            host.saveFile();
        })

        eventBus.on('btn-click', (payload: { name: string, payload: any }) => {
            host.markedPos = null;
            const { name, payload: data } = payload;
            switch (name) {
                case 'annotation': {
                    if (!host.currentNode) break;
                    const node = host.currentNode;
                    if (!node.comments) {
                        node.comments = [];
                    }

                    // 定义所有可能的批注符号
                    const ALL_ANNOTATIONS = ["R+", "B+", "=", "?", "!", "R#", "B#"];
                    const isClickedDataAnnotation = ALL_ANNOTATIONS.includes(data);

                    if (isClickedDataAnnotation) {
                        const existingAnnotationIndex = node.comments.indexOf(data);

                        if (existingAnnotationIndex !== -1) {
                            // 如果点击的批注已存在，则移除它（取消批注）
                            node.comments.splice(existingAnnotationIndex, 1);
                        } else {
                            // 如果点击的批注不存在，则清除所有其他批注，然后添加新的批注
                            node.comments = node.comments.filter((comment: string) => !ALL_ANNOTATIONS.includes(comment)); // 清除所有现有批注
                            node.comments.push(data); // 添加新的批注
                        }
                    }
                    break;
                }
                case 'remove': {
                    if (host.currentNode.id === 'node-root') {
                        host.currentNode.children = [];
                        host.nodeMap.clear();
                        host.nodeMap.set(host.currentNode.id, host.currentNode)
                        eventBus.emit("node-click", host.currentNode.id);
                        break;

                    }
                    const removeNode = host.currentNode;
                    const parentNode = host.nodeMap.get(removeNode.parentID!);

                    host.currentNode = parentNode;

                    if (parentNode) {
                        const index = parentNode.children.indexOf(removeNode);
                        if (index !== -1) parentNode.children.splice(index, 1);
                    }

                    function deleteSubtree(node: ChessNode) {
                        for (const child of node.children) {
                            deleteSubtree(child);
                        }
                        host.nodeMap.delete(node.id);
                    }

                    deleteSubtree(removeNode);
                    host.updateMainPath();
                    eventBus.emit("node-click", host.currentNode.id);
                    break;
                }
                case 'promote': {
                    if (!host.currentNode.parentID || host.currentNode.id === 'node-root') break;

                    let nodeToPromote = host.currentNode;
                    let parent = host.nodeMap.get(nodeToPromote.parentID!);

                    if (!parent) break;

                    // Find the ancestor that is not the first child
                    while (parent.children.length > 0 && parent.children[0].id === nodeToPromote.id) {
                        if (!parent.parentID) break; // Reached the root's direct child, and it's the main line
                        nodeToPromote = parent;
                        parent = host.nodeMap.get(parent.parentID);
                        if (!parent) break;
                    }

                    // Now, `parent` is the node whose children need reordering.
                    // `nodeToPromote` is the child to be promoted.

                    // Clear mainID on all siblings before reordering
                    for (const child of parent.children) {
                        child.mainID = null;
                    }

                    const children = parent.children;
                    const index = children.findIndex((c: ChessNode) => c.id === nodeToPromote.id);

                    if (index > 0) { // If it's not already the main line
                        const item = children[index];
                        // Create new array for reactivity, reordering the item to the front
                        const otherChildren = children.filter((c: ChessNode) => c.id !== item.id);
                        parent.children = [item, ...otherChildren];
                    }

                    host.updateMainPath();
                    break;
                }
                case 'toStart': {
                    host.currentNode = host.nodeMap.get(host.currentPath[0]);
                    host.board = host.currentNode.board;
                    host.currentTurn = host.currentNode.side === 'red' ? 'black' : 'red';
                    break;
                }
                case 'back': {
                    if (host.currentNode.parentID) {
                        host.currentNode = host.nodeMap.get(host.currentNode.parentID);
                        host.board = host.currentNode.board;
                        host.currentTurn = host.currentNode.side === 'red' ? 'black' : 'red';
                    }
                    break;
                }
                case 'next': {
                    const currentIndex = host.currentPath.indexOf(host.currentNode.id);
                    if (currentIndex < host.currentPath.length - 1) {
                        const nextNodeId = host.currentPath[currentIndex + 1];
                        host.currentNode = host.nodeMap.get(nextNodeId);
                        host.board = host.currentNode.board;
                        host.currentTurn = host.currentNode.side === 'red' ? 'black' : 'red';
                    }
                    break;
                }
                case 'toEnd': {
                    host.currentNode = host.nodeMap.get(host.currentPath[host.currentPath.length - 1]);
                    host.board = host.currentNode.board;
                    host.currentTurn = host.currentNode.side === 'red' ? 'black' : 'red';
                    break;
                }
                case 'openPikafish': {
                    // 1. 从 root 节点获取 fen 和 firstturn
                    const initialFen = genFENFromBoard(host.root.board!, host.root.side === 'red' ? 'red' : 'black');

                    // 2. 根据 currentPath 获取行棋的着法
                    // host.mainPath 包含 root 节点，但 root 节点没有 move data，所以从第二个节点开始
                    const movesOnCurrentPath: string[] = [];
                    for (let i = 1; i < host.currentPath.length; i++) {
                        const nodeId = host.currentPath[i];
                        const node = host.nodeMap.get(nodeId);
                        if (node && node.data && node.data.ICCS) {
                            movesOnCurrentPath.push(node.data.ICCS.replace('-', '').toLowerCase());
                        }
                    }
                    const movesStr = movesOnCurrentPath.join('');

                    // 3. 完善 URL
                    const url = `https://xiangqiai.com/#/${initialFen} moves ${movesStr}`;
                    window.open(url);
                    break;
                }
            }

            eventBus.emit('updateUI')
            eventBus.emit('updatePGN')
        })
    }
}


registerPGNViewModule('actions', ActionsModule);

function stringifyPGN(root: ChessNode): string {

    let nodeBrothers = genNodeBrothers(root)
    function genNodeBrothers(root: ChessNode): Map<ChessNode, ChessNode[]> {
        const nodeBrothers = new Map<ChessNode, ChessNode[]>();

        function dfs(node: ChessNode) {
            if (node.children.length > 1) {
                const [mainChild, ...siblings] = node.children;
                nodeBrothers.set(mainChild, siblings);
            }

            for (const child of node.children) {
                dfs(child);
            }
        }

        dfs(root);
        return nodeBrothers;
    }

    function walk(node: ChessNode, stepNum: number): string {
        let result = '';

        if (node.side === 'red') {
            result += `${stepNum}. ${node.data!.ICCS}`;
        } else if (node.side === 'black') {
            result += `${node.data!.ICCS}`;
        }

        // 注释
        if (node.comments?.length) {
            for (const c of node.comments) {
                result += `{${c}}`;
            }
        }

        // 分支（兄弟节点）
        const brothers = nodeBrothers.get(node);
        if (brothers?.length) {
            for (const brother of brothers) {
                if (brother.side === 'red') {
                    result += ` (${walk(brother, stepNum)})`;
                } else if (brother.side === 'black') {
                    result += ` (${stepNum}. ... ${walk(brother, stepNum)})`;
                }
            }
        }

        // 递归主线（第一个子节点）
        if (node.children[0]) {
            const next = node.children[0];
            const nextStepNum = next.side === 'red' ? stepNum + 1 : stepNum;
            result += ` ${walk(next, nextStepNum)}`;
        }

        return result;
    }

    const pgn = walk(root, 0);
    // console.log(pgn);
    return pgn;

}
