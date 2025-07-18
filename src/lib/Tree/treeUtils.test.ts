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
    const J: Node = { move: "J", side: "black", children: [] };
    const I2: Node = { move: "I2", side: "black", children: [] };
    const I3: Node = { move: "I3", side: "black", children: [] };
    const G2: Node = { move: "G2", side: "red", children: [] };
    const C1: Node = { move: "C1", side: "red", children: [] };
    const C2: Node = { move: "C2", side: "red", children: [] };

    // 中间节点
    const G: Node = { move: "G", side: "red", children: [J] };
    const H1: Node = { move: "H1", side: "red", children: [I2, I3] };
    const E: Node = { move: "E", side: "black", children: [G, H1] };
    const F: Node = { move: "F", side: "black", children: [G2] };
    const D: Node = { move: "D", side: "red", children: [E, F] };
    const B: Node = { move: "B", side: "black", children: [D] };
    const C: Node = { move: "C", side: "black", children: [C1, C2] };

    // 根节点
    const A: Node = { move: "A", side: "red", children: [B, C] };
    const root: Node = { move: "root", side: null, children: [A] };
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

    describe('insertBySide()', () => {
        it('红节点插入到目标右侧', () => {
            const nodeArr = [B, C, A]
            insertBySide(nodeArr, D.children, A)
            console.log("操作后:", nodeArr.map(n => n.move));
            // expect(nodeArr).toEqual([B, C, E, F, A])
        })

        it('黑节点插入到目标左侧', () => {
            const nodeArr = [A, B, C, D, E]
            insertBySide(nodeArr, H1.children, A)
            console.log("操作后:", nodeArr.map(n => n.move));
            // expect(nodeArr).toEqual([A, B, I2, I3, C, D, E])
        })
    })

    describe('findFirstMultiChildDescendant()', () => {
        it('找到第一个多子节点', () => {
            const result = findFirstMultiChildDescendant(B)
            expect(result).toBe(D)
        })
    })


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