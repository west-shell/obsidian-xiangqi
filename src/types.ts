export interface ISettings {
  position: 'bottom' | 'right';
  theme: 'light' | 'dark';
  cellSize: number;
}
export interface IPiece {
    type: string;
    x: number;
    y: number;
    pieceEl?: Element;
    hidden?: boolean;
}
export interface IMove {
        fromX: number, fromY: number,
        toX: number, toY: number,
        capture: IPiece | null
    }
