import type { ChessNode, NodeMap } from "../../types";

function findFirstMultiChildDescendant(node: ChessNode): ChessNode | null {
    if (node.children.length > 1) return node;
    // 只检查第一个子节点（因为其他子节点会在上层处理）
    return node.children.length > 0 ? findFirstMultiChildDescendant(node.children[0]) : null;
}

function findFirstNonMainAncestorInArr(node: ChessNode, nodemap: Map<string, ChessNode>): ChessNode | null {
    let current = node;

    // 沿着 main 链一直向上找，直到没有 main
    while (current.mainID) {
        current = nodemap.get(current.mainID)!;
    }

    // 返回最终的节点（如果没有 main，就是 node 自己）
    return current;
}


function insertBySide(arr: ChessNode[], nodes: ChessNode | ChessNode[], target: ChessNode, nodemap: NodeMap): void {
    let nonMainAncestor
    if (!target.mainID) {
        nonMainAncestor = target
    } else {
        nonMainAncestor = findFirstNonMainAncestorInArr(target, nodemap);
    }

    const index = arr.indexOf(nonMainAncestor!);
    if (index === -1) return;

    const insertNodes = Array.isArray(nodes) ? nodes : [nodes];

    // 如果是黑方节点，先反转子节点顺序
    const orderedNodes = insertNodes[0].side === 'black'
        ? [...insertNodes].reverse()
        : insertNodes;

    const insertPos = insertNodes[0].side === 'red' ? index + 1 : index;

    // 过滤掉已存在的节点
    const nodesToInsert = orderedNodes.filter(n => !arr.includes(n));
    arr.splice(insertPos, 0, ...nodesToInsert);
}

function assignY(node: ChessNode, depth = 0) {
    node.y = depth;
    node.children.map((child) => assignY(child, depth + 1));
}
function setIndexForChildren(node: any, i: number) {
    if (node) {
        node.x = i; // 设置当前节点的 x 属性
        // 递归处理子节点的 children[0]，不改变 i
        if (node.children && node.children[0]) {
            setIndexForChildren(node.children[0], i); // 递归处理下一个子节点的 children[0]，i 不变
        }
    }
}

function calcArr(node: ChessNode, nodeArr: ChessNode[], nodeMap: NodeMap) {
    const parent = findFirstMultiChildDescendant(node);
    if (!parent) return;
    parent.children[0].mainID = node.id;
    insertBySide(nodeArr, parent.children, node, nodeMap);
    parent.children.forEach((n) => calcArr(n, nodeArr, nodeMap));
}

export function calculateTreeLayout(nodeMap: NodeMap): ChessNode[] {
    const root = nodeMap.get("node-root");
    if (!root) return [];

    const nodeArr: ChessNode[] = [root];
    calcArr(root, nodeArr, nodeMap);

    const filteredNodeArr = nodeArr.filter((n) => !n.mainID);
    filteredNodeArr.forEach((node, i) => setIndexForChildren(node, i));

    assignY(root);

    return Array.from(nodeMap.values()).filter(
        (n) => n.x !== undefined && n.y !== undefined,
    );
}
