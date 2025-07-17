export type XiangqiMoveNode = {
    move: string;
    side: string | null;
    step?: number;
    comment?: string;
    x?: number;
    y?: number;
    children: XiangqiMoveNode[];
};