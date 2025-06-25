import { IPiece, IBoard, PIECE_CHARS, PieceType, IMove, ITurn } from './types';
// 数字到中文的映射（红方和黑方视角不同）
const NUMBERS_RED = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const NUMBERS_BLACK = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// 移动类型描述
const MOVE_TYPES = {
    horizontal: '平',
    forward: '进',
    backward: '退',
};
export function parseSource(source: string): {
    haveFEN: boolean;
    pieces: IPiece[];
    board: IBoard;
    PGN: IMove[];
    firstTurn: ITurn;
} {

    // 1. 提取FEN（优先从提示词中提取）
    let haveFEN = false;
    let fen =
        source.match(/\[fen\s+"([^"]*)"\]/i)?.[1] || // 先尝试匹配[fen "xxx"]格式
        source.match(/([rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+/)?.[0]; // 再尝试匹配纯FEN+回合格式
    console.log(fen);
    if (!fen) {
        fen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR';
    } else {
        haveFEN = true;
    }
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
    // 2. 提取最后一段走法（去掉注释和换行）
    const PGNString = source.match(/\b[A-Z]\d-[A-Z]\d\b/g) || [];
    let tmpBoard: IBoard = board.map((row) => [...row]);
    const PGN = PGNString.map((string) => {
        const move = parseICCS(string, tmpBoard);
        move.WXF = getWXF(move, tmpBoard);
        runMove(move, tmpBoard);
        return move;
    });
    return {
        haveFEN,
        pieces,
        board,
        PGN,
        firstTurn,
    };
}
export function parseICCS(ICCS: string, tmpBoard: IBoard): IMove {
    // 解析 PGN 字符串为 IMove 数组
    // 解析走法，例如 "H2-D2" -> 起点和终点
    const [fromSting, toSting] = ICCS.split('-');
    const fromX = fromSting.charCodeAt(0) - 'A'.charCodeAt(0);
    const fromY = 9 - parseInt(fromSting[1]); // 修正 Y 坐标，从下往上数
    const toX = toSting.charCodeAt(0) - 'A'.charCodeAt(0);
    const toY = 9 - parseInt(toSting[1]); // 修正 Y 坐标，从下往上数
    const from = { x: fromX, y: fromY };
    const to = { x: toX, y: toY };
    const type = tmpBoard[fromX][fromY];
    if (!type) {
        return { from, to, ICCS };
    }
    return { type, from, to, ICCS };
}
/**
 * 将 { from: { x, y }, to: { x, y } } 转换为 "A0-B7" 格式
 * @param move 包含 from 和 to 的对象，例如 { from: { x: 0, y: 0 }, to: { x: 1, y: 7 } }
 * @returns 返回 "A0-B7" 格式的字符串
 */
export function getICCS(move: IMove): string {
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

export function getWXF(move: IMove, tmpBoard: IBoard): string {
    const { from, to } = move;
    const piece = tmpBoard[from.x][from.y];
    if (!piece) return '';

    const isRed = piece === piece.toUpperCase();
    const numbers = isRed ? NUMBERS_RED : NUMBERS_BLACK;
    const BOARD: IBoard = Array.from({ length: 9 }, () => Array(10).fill(null));
    let fromx = from.x;
    let fromy = from.y;
    let tox = to.x;
    let toy = to.y;
    if (isRed) {
        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 10; y++) {
                BOARD[x][y] = tmpBoard[8 - x][9 - y];
            }
        }
        fromx = 8 - from.x;
        fromy = 9 - from.y;
        tox = 8 - to.x;
        toy = 9 - to.y;
    } else {
        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 10; y++) {
                BOARD[x][y] = tmpBoard[x][y];
            }
        }
    }

    // 获取起始位置描述（红方和黑方的坐标系是相反的）
    let pre = '';
    let samecol: number[] = [];
    // 检查同列是否有相同棋子
    for (let y = 0; y < 10; y++) {
        if (BOARD[fromx][y] === piece) {
            samecol.push(y);
        }
    }
    if (samecol.length === 1) {
        pre = PIECE_CHARS[piece] + numbers[fromx];
    } else if (samecol.length === 2) {
        const index = samecol.indexOf(fromy);
        if (index === 0) {
            pre = '后' + PIECE_CHARS[piece];
        } else if (index === 1) {
            pre = '前' + PIECE_CHARS[piece];
        }
    } else if (samecol.length === 3) {
        const index = samecol.indexOf(fromy);
        if (index === 0) {
            pre = '后' + PIECE_CHARS[piece];
        } else if (index === 1) {
            pre = '中' + PIECE_CHARS[piece];
        } else if (index === 2) {
            pre = '前' + PIECE_CHARS[piece];
        }
    }
    // 确定移动类型和距离
    let moveType: string;
    let dest: string;

    if (fromx === tox) {
        // 纵向移动
        const delta = toy - fromy;
        moveType = delta > 0 ? MOVE_TYPES.forward : MOVE_TYPES.backward;
        dest = numbers[Math.abs(delta) - 1];
    } else if (fromy === toy) {
        // 横向移动
        moveType = MOVE_TYPES.horizontal;
        dest = numbers[tox];
    } else {
        moveType = fromy < toy ? MOVE_TYPES.forward : MOVE_TYPES.backward;
        dest = numbers[tox];
    }
    return `${pre}${moveType}${dest}`;
}
function runMove(move: IMove, board: IBoard) {
    const { from, to } = move;
    const piece = board[from.x][from.y];
    if (!piece) return;
    board[to.x][to.y] = piece;
    board[from.x][from.y] = null;
}
