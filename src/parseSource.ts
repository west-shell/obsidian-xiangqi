import { IPiece, IBoard, PieceType, IMove, ITurn } from './types';
export function parseSource(source: string): {
    pieces: IPiece[];
    board: IBoard;
    PGN: IMove[];
    firstTurn: ITurn;
} {
    // 1. 提取FEN（优先从提示词中提取）
    let fen =
        source.match(/\[fen\s+"([^"]*)"\]/i)?.[1] || // 先尝试匹配[fen "xxx"]格式
        source.match(/([rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+/)?.[0] || // 再尝试匹配纯FEN+回合格式
        'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR'; // 默认初始局面

    // 2. 提取最后一段走法（去掉注释和换行）
    const PGNString = source.match(/\b[A-Z]\d-[A-Z]\d\b/g) || [];
    const PGN = PGNString.map((string) => parsePGN(string)); // 移除空格和换行符
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
        firstTurn,
    };
}
export function parsePGN(PGN: string): IMove {
    // 解析 PGN 字符串为 IMove 数组
    // 解析走法，例如 "H2-D2" -> 起点和终点
    const [fromSting, toSting] = PGN.split('-');
    const fromX = fromSting.charCodeAt(0) - 'A'.charCodeAt(0);
    const fromY = 9 - parseInt(fromSting[1]); // 修正 Y 坐标，从下往上数
    const toX = toSting.charCodeAt(0) - 'A'.charCodeAt(0);
    const toY = 9 - parseInt(toSting[1]); // 修正 Y 坐标，从下往上数
    const from = { x: fromX, y: fromY };
    const to = { x: toX, y: toY };
    return { from, to };
}
/**
 * 将 { from: { x, y }, to: { x, y } } 转换为 "A0-B7" 格式
 * @param move 包含 from 和 to 的对象，例如 { from: { x: 0, y: 0 }, to: { x: 1, y: 7 } }
 * @returns 返回 "A0-B7" 格式的字符串
 */
export function getPGN(move: IMove): string {
    // 校验输入
    if (move.from.x == null || move.from.y == null || move.to.x == null || move.to.y == null) {
        throw new Error('Invalid move: x and y must be numbers');
    }

    // 将 x 转换为大写字母（0=A, 1=B, ..., 7=H）
    const xToLetter = (x: number): string => {
        if (x < 0 || x > 25) throw new Error(`x must be between 0 and 25, got ${x}`);
        return String.fromCharCode(65 + x); // 65 = 'A' 的 ASCII 码
    };

    const fromStr = `${xToLetter(move.from.x)}${9 - move.from.y}`;
    const toStr = `${xToLetter(move.to.x)}${9 - move.to.y}`;

    return `${fromStr}-${toStr}`;
}
