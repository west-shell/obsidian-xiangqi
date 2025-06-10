import { IPiece, IBoard, PieceType } from "./types";
export function parseSource(source: string): {
    pieces: IPiece[];
    board: IBoard;
    PGN: string[];
    firstTurn: 'black' | 'red';
} { // 1. 提取FEN（优先从提示词中提取）
    let fen = (source.match(/\[fen\s+"([^"]*)"\]/i)?.[1]  // 先尝试匹配[fen "xxx"]格式
        || source.match(/([rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+/)?.[0]// 再尝试匹配纯FEN+回合格式
        || "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR" // 默认初始局面
    );

    // 2. 提取最后一段走法（去掉注释和换行）
    const PGN = source.match(/\b[A-Z]\d-[A-Z]\d\b/g) || [];
    const board: IBoard = Array.from({ length: 10 }, () => Array(9).fill(null));
    const pieces: IPiece[] = [];
    const [position, turn] = fen.trim().split(/\s+/);

    const rows = position.split('/');
    rows.forEach((row, y) => {
        let x = 0;
        for (const char of row) {
            if (/[1-9]/.test(char)) {
                x += parseInt(char);
            } else if (/[a-zA-Z]/.test(char)) {
                board[x][y] = char as PieceType;
                pieces.push({ type: char as PieceType, position: { x, y } });
                x++;
            }
        }
    });
    const firstTurn = turn === 'b' ? 'black' : 'red';

    return {
        pieces,
        board,
        PGN,
        firstTurn
    };
}