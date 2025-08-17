import type { ChessNode, NodeMap } from "../../types";

export function calcArr(node: ChessNode): ChessNode[] {
    let result: ChessNode[] = [node];
    if (node.children) {
        for (const child of node.children) {
            result = result.concat(calcArr(child));
        }
    }
    return result;
}

export function findFirstMultiChildDescendant(node: ChessNode): ChessNode | null {
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


export function insertBySide(arr: ChessNode[], nodes: ChessNode | ChessNode[], target: ChessNode, nodemap: NodeMap): void {
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

export function assignY(node: ChessNode, depth = 0) {
    node.y = depth;
    node.children.map((child) => assignY(child, depth + 1));
}
export function setIndexForChildren(node: any, i: number) {
    if (node) {
        node.x = i; // 设置当前节点的 x 属性
        // 递归处理子节点的 children[0]，不改变 i
        if (node.children && node.children[0]) {
            setIndexForChildren(node.children[0], i); // 递归处理下一个子节点的 children[0]，i 不变
        }
    }
}
