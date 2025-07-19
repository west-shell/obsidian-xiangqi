export type Node = {
    move: string;
    side: string | null;
    step?: number;
    comment?: string;
    x?: number;
    y?: number;
    children: Node[];
    parent: Node;
    main?: boolean;
};