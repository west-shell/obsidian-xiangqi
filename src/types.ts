export interface ISettings {
    position: 'bottom' | 'right';
    theme: 'light' | 'dark';
    cellSize: number;
}
export type PieceType = 'r' | 'R' | 'n' | 'N' | 'b' | 'B' | 'a' | 'A' | 'k' | 'K' | 'c' | 'C' | 'p' | 'P';
export type IBoard = (PieceType | null)[][];
export type IPosition = { x: number; y: number };
export interface IPiece {
    type: PieceType;
    position: IPosition;
    pieceEl?: Element;
    hidden?: boolean;
}
export interface IMove {
    from: IPosition;
    to: IPosition;
    capture?: IPiece | null;
}
export type IHistory = IMove[];
export interface IState {
    settings: ISettings;
    board: IBoard;
    pieces: IPiece[] | null;
    currentTurn: 'red' | 'black';
    currentStep: number;
    history: IHistory;
    PGN: IMove[];
    modified: boolean;
}
