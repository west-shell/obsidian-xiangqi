import { describe, it, expect, beforeEach } from 'vitest'
import {
    calcArr,
    insertBySide,
    findFirstMultiChildDescendant,
    assignY,
    setIndexForChildren,
} from './utils'
import type { Node } from './types'

describe('树形结构工具函数', () => {
    // 叶子节点
    let root: any, A, B, C, D, E, F, G, G2, H1, I2, I3, J, C1, C2;

    J = { move: "J", side: "black", children: [], parent: G, step: 7 };
    I2 = { move: "I2", side: "black", children: [], parent: H1, step: 9 };
    I3 = { move: "I3", side: "black", children: [], parent: H1, step: 10 };
    G2 = { move: "G2", side: "red", children: [], parent: F, step: 8 };
    C1 = { move: "C1", side: "red", children: [], parent: C, step: 4 };
    C2 = { move: "C2", side: "red", children: [], parent: C, step: 5 };

    G = { move: "G", side: "red", children: [J], parent: E, step: 6 };
    H1 = { move: "H1", side: "red", children: [I2, I3], parent: E, step: 6 };

    E = { move: "E", side: "black", children: [G, H1], parent: D, step: 5 };
    F = { move: "F", side: "black", children: [G2], parent: D, step: 5 };

    D = { move: "D", side: "red", children: [E, F], parent: B, step: 4 };
    B = { move: "B", side: "black", children: [D], parent: A, step: 3 };
    C = { move: "C", side: "black", children: [C1, C2], parent: A, step: 3 };

    A = { move: "A", side: "red", children: [B, C], parent: root, step: 2 };
    root = { move: "root", side: null, children: [A], step: 1 };

    //     root（无颜色）
    // │
    // └── A(红)
    //     ├── B(黑)
    //     │   └── D(红)
    //     │       ├── E(黑)
    //     │       │   ├── G(红)
    //     │       │   │   └── J(黑)
    //     │       │   └── H1(红)
    //     │       │       ├── I2(黑)
    //     │       │       └── I3(黑)
    //     │       └── F(黑)
    //     │           └── G2(红)
    //     └── C(黑)
    //         ├── C1(红)
    //         └── C2(红)

    describe('calcArr()', () => {
        it('计算节点数组', () => {
            const nodeArr = calcArr(root)
            console.log("计算后:", nodeArr.map(n => n.move));
        })
    })

    // describe('insertBySide()', () => {
    //     it('红节点插入到目标右侧', () => {
    //         const nodeArr = [B, C, A]
    //         insertBySide(nodeArr, D.children, A)
    //         console.log("操作后:", nodeArr.map(n => n.move));
    //         // expect(nodeArr).toEqual([B, C, E, F, A])
    //     })

    //     it('黑节点插入到目标左侧', () => {
    //         const nodeArr = [A, B, C, D, E]
    //         insertBySide(nodeArr, H1.children, A)
    //         console.log("操作后:", nodeArr.map(n => n.move));
    //         // expect(nodeArr).toEqual([A, B, I2, I3, C, D, E])
    //     })
    // })

    // describe('findFirstMultiChildDescendant()', () => {
    //     it('找到第一个多子节点', () => {
    //         const result = findFirstMultiChildDescendant(B)
    //         expect(result).toBe(D)
    //     })
    // })


    // describe('assignY()', () => {
    //     it('分配深度坐标', () => {
    //         const tree = createNode(null, [
    //             createNode('red', [createNode('black')])
    //         ])

    //         assignY(tree)
    //         expect(tree.y).toBe(0)
    //         expect(tree.children[0].y).toBe(1)
    //         expect(tree.children[0].children[0].y).toBe(2)
    //     })
    // })

    // describe('setIndexForChildren()', () => {
    //     it('设置主线x坐标', () => {
    //         const mainLineNode = createNode('red')
    //         const tree = createNode(null, [
    //             mainLineNode,
    //             createNode('black') // 分支节点
    //         ])

    //         setIndexForChildren(tree, 0)
    //         expect(tree.x).toBe(0)
    //         expect(mainLineNode.x).toBe(0)
    //         expect(tree.children[1].x).toBeUndefined() // 分支节点不设置
    //     })
    // })
})