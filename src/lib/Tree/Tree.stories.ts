
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
let root: any, A, B, C, D, E, F, G, G2, H1, I2, I3, J, C1, C2;

J = { move: "J", side: "black", children: [], parent: G };
I2 = { move: "I2", side: "black", children: [], parent: H1 };
I3 = { move: "I3", side: "black", children: [], parent: H1 };
G2 = { move: "G2", side: "red", children: [], parent: F };
C1 = { move: "C1", side: "red", children: [], parent: C };
C2 = { move: "C2", side: "red", children: [], parent: C };

G = { move: "G", side: "red", children: [J], parent: E };
H1 = { move: "H1", side: "red", children: [I2, I3], parent: E };

E = { move: "E", side: "black", children: [G, H1], parent: D };
F = { move: "F", side: "black", children: [G2], parent: D };

D = { move: "D", side: "red", children: [E, F], parent: B };

B = { move: "B", side: "black", children: [D], parent: A };
C = { move: "C", side: "black", children: [C1, C2], parent: A };

A = { move: "A", side: "red", children: [B, C], parent: root };

root = { move: "root", side: null, children: [A] };

export const Default: Story = {
    args: {
        root: root
    }
};
