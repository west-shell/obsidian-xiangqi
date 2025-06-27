export interface ISettings {
    position: 'bottom' | 'right';
    theme: 'light' | 'dark';
    cellSize: number;
    fontSize: number;
    autoJump: 'never' | 'always' | 'auto';
    enableSpeech: boolean;
    showPGN: boolean;
    showPGNtxt: boolean;
}
export type ITurn = 'red' | 'black';
// prettier-ignore
export const PIECE_CHARS = {
    // 红方 (大写)
    R: '俥', N: '傌', B: '相', A: '仕', K: '帅', C: '炮', P: '兵',
    // 黑方 (小写)
    r: '车', n: '马', b: '象', a: '士', k: '将', c: '砲', p: '卒',
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
export interface IState {
    settings: ISettings;
    board: IBoard;
    pieces: IPiece[] | null;
    currentTurn: ITurn;
    currentStep: number;
    history: IHistory;
    PGN: IMove[];
    modified: boolean;
}
