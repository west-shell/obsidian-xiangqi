
// src/Tree.stories.ts
import type { Meta, StoryObj } from '@storybook/svelte';
import Tree from './Tree.svelte';
import type { Node } from './types';

const meta = {
    title: 'Components/Tree',
    component: Tree,
    parameters: {
        layout: 'centered'
    }
} satisfies Meta<typeof Tree>;

export default meta;

type Story = StoryObj<typeof meta>;
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


export const Default: Story = {
    args: {
        root: root
    }
};
