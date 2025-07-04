export interface ISettings {
    position: 'bottom' | 'right';
    theme: 'light' | 'dark';
    autoTheme: boolean;
    cellSize: number;
    fontSize: number;
    autoJump: 'never' | 'always' | 'auto';
    enableSpeech: boolean;
    showPGN: boolean;
    showPGNtxt: boolean;
    viewOnly?: boolean;
    rotated?: boolean;
}
export type ITurn = 'red' | 'blue';
// prettier-ignore
export const PIECE_CHARS = {
    // 黑方 (小写)
    k: '将', a: '士', b: '象', r: '车', n: '马', c: '砲', p: '卒',
    // 红方 (大写)
    K: '帅', A: '仕', B: '相', R: '俥', N: '傌', C: '炮', P: '兵',
} as const;
export type PieceType = keyof typeof PIECE_CHARS;
export type IBoard = (PieceType | null)[][];
export type IPosition = { x: number; y: number };
export interface IPiece {
    type: PieceType;
    position: IPosition;
    pieceEl?: Element;
    hidden?: boolean;
}
export interface IMove {
    type?: PieceType;
    from: IPosition;
    to: IPosition;
    capture?: IPiece | null;
    ICCS?: string;
    WXF?: string;
}
export type IHistory = IMove[];
