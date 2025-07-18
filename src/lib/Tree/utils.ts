import type { Node } from "./types";

export function insertBySide(arr: Node[], nodes: Node | Node[], target: Node): void {
    const index = arr.indexOf(target);
    if (index === -1) return;

    const insertNodes = Array.isArray(nodes) ? nodes : [nodes];
    const insertPos = insertNodes[0].side === 'red' ? index + 1 : index;

    // 过滤掉已存在的节点
    const nodesToInsert = insertNodes.filter(n => !arr.includes(n));
    arr.splice(insertPos, 0, ...nodesToInsert);
}

export function findFirstMultiChildDescendant(node: Node): Node | null {
    if (node.children.length > 1) return node;
    // 只检查第一个子节点（因为其他子节点会在上层处理）
    return node.children.length > 0 ? findFirstMultiChildDescendant(node.children[0]) : null;
}

export function assignY(node: Node, depth = 0) {
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