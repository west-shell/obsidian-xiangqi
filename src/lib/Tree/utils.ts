import type { Node } from "./types";

export function calcArr(node: Node) {
    let nodeArr = [node];
    function inner(node: Node) {
        const parent = findFirstMultiChildDescendant(node);
        if (!parent) return;
        parent.children[0].main = true;
        insertBySide(nodeArr, parent.children, node);
        parent.children.forEach((n) => inner(n));
    }
    inner(node);
    return nodeArr;
}

function hasDescendant(node1: Node, node2: Node): boolean {
    for (const child of node1.children) {
        if (child === node2) return true;
        if (hasDescendant(child, node2)) return true;
    }
    return false;
}

function findFirstNonMainAncestorInArr(node: Node, arr: Node[]): Node | null {
    const result = arr.filter(n => {
        return !n.main && hasDescendant(n, node);
    });

    const maxStepNode = result.reduce((maxNode, current) => {
        if (!maxNode) return current;
        return (current.step ?? -Infinity) > (maxNode.step ?? -Infinity) ? current : maxNode;
    }, null as Node | null);

    return maxStepNode;
}


export function insertBySide(arr: Node[], nodes: Node | Node[], target: Node): void {
    let nonMainAncestor
    if (!target.main) {
        nonMainAncestor = target
    } else {
        nonMainAncestor = findFirstNonMainAncestorInArr(target, arr);
    }

    // const nonMainAncestor = findFirstNonMainAncestorInArr(target, arr);
    // const nonMainAncestor = target
    // if (!nonMainAncestor) {
    //     console.warn("目标节点没有非主祖先");
    //     return;
    // }

    const index = arr.indexOf(nonMainAncestor);
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

    console.log('当前数组:', arr.map(n =>
        `${n.move}${n.main ? '(main)' : ''}`
    ));
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