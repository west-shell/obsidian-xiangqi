import { describe, it, expect, beforeEach } from 'vitest'
import {
    insertBySide,
    findFirstMultiChildDescendant,
    assignY,
    setIndexForChildren,
} from './utils'
import type { Node } from './types'

describe('树形结构工具函数', () => {
    // 创建测试节点（无id版本）
    interface Node {
        move: string;
        side: 'red' | 'black';
        children: Node[];
    }

    /* 先定义所有叶子节点 */
    // 第一支
    const K: Node = { move: "车1平2", side: "red", children: [] };
    const J: Node = { move: "马三进四", side: "black", children: [K] };
    const I: Node = { move: "炮2进4", side: "red", children: [J] };

    // 分支 A1 - 黑方分支（两个黑子）
    const I2: Node = { move: "车9平8", side: "black", children: [] };
    const I3: Node = { move: "马8进7", side: "black", children: [] };
    const H1: Node = { move: "兵七进一", side: "red", children: [I2, I3] };

    // 主线继续
    const G: Node = { move: "卒3进1", side: "black", children: [I] };

    // 红方也有分支
    const G2: Node = { move: "兵九进一", side: "red", children: [] };
    const F: Node = { move: "象7进5", side: "black", children: [G2] };

    // 主线整合
    const E: Node = { move: "车一平二", side: "red", children: [G, H1] };
    const D: Node = { move: "马8进7", side: "black", children: [E, F] };

    // 根之后的第一步红方也分支
    const C1: Node = { move: "兵三进一", side: "red", children: [] };
    const C2: Node = { move: "兵五进一", side: "red", children: [] };
    const C: Node = { move: "马2进3", side: "black", children: [C1, C2] };

    const B: Node = { move: "马二进三", side: "red", children: [D] };
    const A: Node = { move: "炮二平五", side: "red", children: [B, C] };

    const root = A;
    //     A(红)
    // ├── B(红)
    // │   └── E(黑)
    // │       ├── G(红)
    // │       │   ├── H(黑)
    // │       │   │   └── K(红)
    // │       │   │       └── L(黑)
    // │       │   │           └── M(红)
    // │       │   └── I(红)
    // │       │       ├── J1(黑)
    // │       │       └── J2(黑)
    // │       └── F(黑)
    // └── C(黑)
    //     ├── D1(红)
    //     └── D2(红)


    describe('insertBySide()', () => {
        it('红节点插入到目标右侧', () => {
            const nodeArr = [B, C, A]
            insertBySide(nodeArr, D.children, C)

            expect(nodeArr).toEqual([B, C, E, F, A])
        })

        it('黑节点插入到目标左侧', () => {
            const nodeArr = [A, B, C, D, E]
            insertBySide(nodeArr, H1.children, C)

            expect(nodeArr).toEqual([A, B, I2, I3, C, D, E])
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