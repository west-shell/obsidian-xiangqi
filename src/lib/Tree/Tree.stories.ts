
// src/Tree.stories.ts
import type { Meta, StoryObj } from '@storybook/svelte';
import Tree from './Tree.svelte';
import type { XiangqiMoveNode } from './types';

const meta = {
    title: 'Components/Tree',
    component: Tree,
    parameters: {
        layout: 'centered'
    }
} satisfies Meta<typeof Tree>;

export default meta;

type Story = StoryObj<typeof meta>;

const moveTree = {
    move: "开始",
    side: null,
    children: [
        {
            move: "炮二平五",
            side: "red",
            children: [
                {
                    move: "马8进7",
                    side: "black",
                    comment: "黑方常见应对",
                    children: [
                        {
                            move: "马二进三",
                            side: "red",
                            children: [
                                {
                                    move: "车9平8",
                                    side: "black",
                                    children: [
                                        {
                                            move: "车一平二",
                                            side: "red",
                                            children: [
                                                {
                                                    move: "象7进5",
                                                    side: "black",
                                                    children: []
                                                },
                                                {
                                                    move: "卒3进1",
                                                    side: "black",
                                                    comment: "尝试抢先开边卒",
                                                    children: [{
                                                        move: "炮二平五",
                                                        side: "red",
                                                        children: [
                                                            {
                                                                move: "马8进7",
                                                                side: "black",
                                                                comment: "黑方常见应对",
                                                                children: [
                                                                    {
                                                                        move: "马二进三",
                                                                        side: "red",
                                                                        children: [
                                                                            {
                                                                                move: "车9平8",
                                                                                side: "black",
                                                                                children: [
                                                                                    {
                                                                                        move: "车一平二",
                                                                                        side: "red",
                                                                                        children: [
                                                                                            {
                                                                                                move: "象7进5",
                                                                                                side: "black",
                                                                                                children: []
                                                                                            },
                                                                                            {
                                                                                                move: "卒3进1",
                                                                                                side: "black",
                                                                                                comment: "尝试抢先开边卒",
                                                                                                children: []
                                                                                            }
                                                                                        ]
                                                                                    }
                                                                                ]
                                                                            }
                                                                        ]
                                                                    },
                                                                    {
                                                                        move: "兵七进一",
                                                                        side: "red",
                                                                        comment: "变招：弃兵抢先",
                                                                        children: [
                                                                            {
                                                                                move: "车9平8",
                                                                                side: "black",
                                                                                children: []
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        move: "马二进三",
                                                        side: "red",
                                                        step: 1,
                                                        children: [
                                                            {
                                                                move: "马8进7",
                                                                side: "black",
                                                                step: 2,
                                                                children: [
                                                                    {
                                                                        move: "兵三进一",
                                                                        side: "red",
                                                                        step: 3,
                                                                        children: [
                                                                            {
                                                                                move: "车9平8",
                                                                                side: "black",
                                                                                step: 4,
                                                                                children: []
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            move: "兵七进一",
                            side: "red",
                            comment: "变招：弃兵抢先",
                            children: [
                                {
                                    move: "车9平8",
                                    side: "black",
                                    children: [{
                                        move: "炮二平五",
                                        side: "red",
                                        children: [
                                            {
                                                move: "马8进7",
                                                side: "black",
                                                comment: "黑方常见应对",
                                                children: [
                                                    {
                                                        move: "马二进三",
                                                        side: "red",
                                                        children: [
                                                            {
                                                                move: "车9平8",
                                                                side: "black",
                                                                children: [
                                                                    {
                                                                        move: "车一平二",
                                                                        side: "red",
                                                                        children: [
                                                                            {
                                                                                move: "象7进5",
                                                                                side: "black",
                                                                                children: []
                                                                            },
                                                                            {
                                                                                move: "卒3进1",
                                                                                side: "black",
                                                                                comment: "尝试抢先开边卒",
                                                                                children: []
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        move: "兵七进一",
                                                        side: "red",
                                                        comment: "变招：弃兵抢先",
                                                        children: [
                                                            {
                                                                move: "车9平8",
                                                                side: "black",
                                                                children: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        move: "马二进三",
                                        side: "red",
                                        step: 1,
                                        children: [
                                            {
                                                move: "马8进7",
                                                side: "black",
                                                step: 2,
                                                children: [
                                                    {
                                                        move: "兵三进一",
                                                        side: "red",
                                                        step: 3,
                                                        children: [
                                                            {
                                                                move: "车9平8",
                                                                side: "black",
                                                                step: 4,
                                                                children: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            move: "马二进三",
            side: "red",
            step: 1,
            children: [
                {
                    move: "马8进7",
                    side: "black",
                    step: 2,
                    children: [
                        {
                            move: "兵三进一",
                            side: "red",
                            step: 3,
                            children: [
                                {
                                    move: "车9平8",
                                    side: "black",
                                    step: 4,
                                    children: []
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};
export const Default: Story = {
    args: {
        root: moveTree
    }
};
