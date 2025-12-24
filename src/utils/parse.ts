import type { IBoard, IMove, IOptions, ITurn, PieceType } from "../types";
import { PIECE_CHARS } from "../types";


export function parseSource(source: string): {
    haveFEN: boolean;
    board: IBoard;
    PGN: IMove[];
    firstTurn: ITurn;
    options: IOptions;
    isPikafishUrl?: boolean;
} {
    const options = parseOption(source);

    const pikafishData = parsePikafishUrl(source);
    if (pikafishData) {
        return { ...pikafishData, options, isPikafishUrl: true };
    }

    let haveFEN = false;
    let fen =
        source.match(
            /([rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+(?:\s+[wb])?/,
        )?.[0];
    if (!fen) {
        fen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR";
    } else {
        haveFEN = true;
    }
    // 1. 解析 FEN 字符串
    const { board, turn } = loadBoardFromFEN(fen);
    const firstTurn = turn === "b" ? "black" : "red";
    // 2. 提取最后一段走法（去掉注释和换行）
    const PGNString = source.match(/\b[A-Z]\d-[A-Z]\d\b/g) || [];
    let tmpBoard: IBoard = board.map((row) => [...row]);
    const PGN = PGNString.map((string) => {
        const move = parseICCS(string, tmpBoard);
        move.WXF = getWXF(move, tmpBoard);
        tmpBoard[move.to.x][move.to.y] = tmpBoard[move.from.x][move.from.y];
        tmpBoard[move.from.x][move.from.y] = null;
        return move;
    });
    return {
        haveFEN,
        board,
        PGN,
        firstTurn,
        options
    };
}

function parsePikafishUrl(source: string): {
    haveFEN: boolean;
    board: IBoard;
    PGN: IMove[];
    firstTurn: ITurn;
} | null {
    // 匹配 https://xiangqiai.com/#/ 之后的所有内容，直到换行或结束
    const match = source.match(/https:\/\/xiangqiai\.com\/#\/([^\s\n]+)/);
    if (!match) return null;

    let raw = match[1];
    try {
        raw = decodeURIComponent(raw);
    } catch (e) {
        // ignore error
    }

    // 分割 FEN 和 moves
    // URL 格式通常为: <FEN> w moves <move1><move2>...
    // 或者 <FEN> w moves <move1> <move2> ...
    // 使用正则分割更稳健
    const parts = raw.split(/\s+moves\s+/);
    let fenPart = parts[0];
    const movesStr = parts[1] || "";

    const { board, turn } = loadBoardFromFEN(fenPart);
    const firstTurn = turn === "b" ? "black" : "red";

    let PGN: IMove[] = [];
    if (movesStr) {
        let tmpBoard: IBoard = board.map((row) => [...row]);

        // 匹配所有 moves，格式为 [a-i]\d[a-i]\d
        const moveMatches = movesStr.match(/[a-i]\d[a-i]\d/gi);

        if (moveMatches) {
            for (const moveStr of moveMatches) {
                const fromFile = moveStr[0].toUpperCase();
                const fromRank = moveStr[1];
                const toFile = moveStr[2].toUpperCase();
                const toRank = moveStr[3];

                const iccs = `${fromFile}${fromRank}-${toFile}${toRank}`;

                const move = parseICCS(iccs, tmpBoard);
                move.WXF = getWXF(move, tmpBoard);

                if (tmpBoard[move.to.x] && tmpBoard[move.to.x][move.to.y] !== undefined) {
                    tmpBoard[move.to.x][move.to.y] = tmpBoard[move.from.x][move.from.y];
                    tmpBoard[move.from.x][move.from.y] = null;
                }

                PGN.push(move);
            }
        }
    }

    return {
        haveFEN: true,
        board,
        PGN,
        firstTurn
    };
}

export function loadBoardFromFEN(fen: string): { board: IBoard; turn: string } {
    const board: IBoard = Array.from({ length: 9 }, () => Array(10).fill(null));
    const [position, turn] = fen.trim().split(/\s+/);
    const rows = position.split("/");
    rows.forEach((row, y) => {
        let x = 0;
        for (const char of row) {
            if (/[1-9]/.test(char)) {
                x += parseInt(char);
            } else if (/[a-zA-Z]/.test(char)) {
                board[x][y] = char as PieceType;
                x++;
            }
        }
    });
    return { board, turn };
}

/**
 * 从字符串中解析预定义的选项（viewOnly/rotated/showPGN）
 * @param source 输入的字符串
 * @returns 包含已解析选项的对象（仅包含匹配到的选项）
 */
export function parseOption(source: string): IOptions {
    const options: IOptions = {};
    const optionPatterns = [
        { key: "protected", regex: /\b(protected|P)\s*[:：]\s*(true|false)\s*/i },
        { key: "rotated", regex: /\b(rotated|r)\s*[:：]\s*(true|false)\s*/i },
        // { key: 'showPGN', regex: /\b(showPGN|s)\s*[:：]\s*(true|false)\s*/i }
    ];

    optionPatterns.forEach(({ key, regex }) => {
        const match = source.match(regex);
        if (match) {
            options[key as keyof IOptions] = match[2].toLowerCase() === "true";
        }
    });

    return options;
}

export function parseICCS(ICCS: string, tmpBoard: IBoard): IMove {
    // 解析 PGN 字符串为 IMove 数组
    // 解析走法，例如 "H2-D2" -> 起点和终点
    const [fromSquare, toSquare] = ICCS.split("-");
    const fromX = fromSquare.charCodeAt(0) - "A".charCodeAt(0);
    const fromY = 9 - parseInt(fromSquare[1]); // 修正 Y 坐标，从下往上数
    const toX = toSquare.charCodeAt(0) - "A".charCodeAt(0);
    const toY = 9 - parseInt(toSquare[1]); // 修正 Y 坐标，从下往上数
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
    if (
        move.from.x == null ||
        move.from.y == null ||
        move.to.x == null ||
        move.to.y == null
    ) {
        throw new Error("Invalid move: x and y must be numbers");
    }

    // 将 x 转换为大写字母（0=A, 1=B, ..., 7=H）
    const xToLetter = (x: number): string => {
        if (x < 0 || x > 25)
            throw new Error(`x must be between 0 and 25, got ${x}`);
        return String.fromCharCode(65 + x); // 65 = 'A' 的 ASCII 码
    };

    const fromStr = `${xToLetter(move.from.x)}${9 - move.from.y}`;
    const toStr = `${xToLetter(move.to.x)}${9 - move.to.y}`;

    return `${fromStr}-${toStr}`;
}

export function getWXF(move: IMove, tmpBoard: IBoard): string {

    const MOVE_TYPES = {
        horizontal: "平",
        forward: "进",
        backward: "退",
    };

    const NUMBERS_RED = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const NUMBERS_BLACK = ["１", "２", "３", "４", "５", "６", "７", "８", "９"];

    const { from, to } = move;
    const piece = tmpBoard[from.x][from.y];
    if (!piece) return "";

    const isRed = piece === piece.toUpperCase();
    const pieceType = piece.toLowerCase();
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

    const FRONT_LABELS = ["后", "中", "前"];
    const NUMBER_LABELS = ["一", "二", "三", "四", "五"];

    function getIndexLabel(index: number, count: number) {
        if (count === 2) return index === 0 ? "后" : "前";
        if (count === 3) return FRONT_LABELS[index];
        if (count >= 4) return NUMBER_LABELS[count - index - 1];
        return "";
    }
    function getPawnPrefix(
        piece: PieceType,
        fromx: number,
        fromy: number,
        BOARD: IBoard,
    ) {
        const colMap = new Map<number, number[]>();

        // 收集所有兵的位置
        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 10; y++) {
                if (BOARD[x][y] === piece) {
                    (colMap.get(x) ?? colMap.set(x, []).get(x)!).push(y);
                }
            }
        }

        // 找出“同列多个兵”的列
        const multiCols = [...colMap.entries()]
            .filter(([, ys]) => ys.length > 1)
            .map(([x]) => x);

        // 没有冲突，直接用列号
        if (!multiCols.includes(fromx)) {
            return PIECE_CHARS[piece] + numbers[fromx];
        }

        const ys = colMap.get(fromx)!;
        const index = ys.indexOf(fromy);

        // 只有一列有多个兵
        if (multiCols.length === 1) {
            return getIndexLabel(index, ys.length) + PIECE_CHARS[piece];
        }

        // 两列都有多个兵（按规则编号）
        if (multiCols.length === 2) {
            const [leftCol, rightCol] = multiCols;

            let offset = 0;
            if (fromx === rightCol) {
                offset = colMap.get(leftCol)!.length;
            }

            const label = NUMBER_LABELS[offset + (ys.length - index - 1)];
            return label + PIECE_CHARS[piece];
        }

        // fallback
        return PIECE_CHARS[piece] + numbers[fromx];
    }

    function getNormalPrefix(
        piece: PieceType,
        fromx: number,
        fromy: number,
        BOARD: IBoard,
    ) {
        const sameCol: number[] = [];

        for (let y = 0; y < 10; y++) {
            if (BOARD[fromx][y] === piece) {
                sameCol.push(y);
            }
        }

        if (sameCol.length === 1) {
            return PIECE_CHARS[piece] + numbers[fromx];
        }

        if (sameCol.length === 2) {
            return sameCol[0] === fromy
                ? "后" + PIECE_CHARS[piece]
                : "前" + PIECE_CHARS[piece];
        }

        return PIECE_CHARS[piece] + numbers[fromx];
    }

    let pre = "";

    if (pieceType === "a" || pieceType === "b") {
        pre = PIECE_CHARS[piece] + numbers[fromx];
    } else if (pieceType === "p") {
        pre = getPawnPrefix(piece, fromx, fromy, BOARD);
    } else {
        pre = getNormalPrefix(piece, fromx, fromy, BOARD);
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

export function parseWXF(wxf: string, board: IBoard, isRed: boolean): IMove | null {
    const NUMBERS = isRed
        ? ["一", "二", "三", "四", "五", "六", "七", "八", "九"]
        : ["１", "２", "３", "４", "５", "６", "７", "８", "９"];
    const NUM_TO_INDEX = Object.fromEntries(NUMBERS.map((n, i) => [n, i]));

    // 检测格式：前炮平五、车二进六、马八进七等
    const match = wxf.match(/^([前中后]?)([车马炮兵卒相仕象士将帅])([平进退])([一二三四五六七八九１２３４５６７８９])$/);
    if (!match) return null;

    const [, positionHint, pieceChar, action, destChar] = match;
    const destIndex = NUM_TO_INDEX[destChar];
    if (destIndex === undefined) return null;

    // 构造棋子 unicode 对应字符
    const targetPiece = Object.entries(PIECE_CHARS).find(
        ([key, val]) => val === pieceChar && (isRed === (key === key.toUpperCase()))
    )?.[0];
    if (!targetPiece) return null;

    // 镜像转换
    const flipX = (x: number) => (isRed ? 8 - x : x);
    const flipY = (y: number) => (isRed ? 9 - y : y);
    const realBoard: IBoard = isRed
        ? Array.from({ length: 9 }, (_, x) =>
            Array.from({ length: 10 }, (_, y) => board[8 - x][9 - y])
        )
        : board;

    // 找出所有匹配棋子的坐标
    const candidates: { x: number; y: number }[] = [];
    for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 10; y++) {
            if (realBoard[x][y] === targetPiece) {
                candidates.push({ x, y });
            }
        }
    }

    // 进一步筛选列或行（车八进三 = 车在第 7 列 = x==7）
    let from: { x: number; y: number } | null = null;
    let to: { x: number; y: number } | null = null;

    // 确定起始位置
    if (!positionHint) {
        // 直接数字，如"车二进六"
        for (const p of candidates) {
            if (p.x === NUM_TO_INDEX[match[2]]) {
                from = p;
                break;
            }
        }
    } else {
        // 有 前中后，先按x排序（纵向）
        const sorted = candidates.sort((a, b) => a.y - b.y);
        if (sorted.length >= 2) {
            if (positionHint === "前") from = sorted[sorted.length - 1];
            if (positionHint === "中" && sorted.length >= 3) from = sorted[1];
            if (positionHint === "后") from = sorted[0];
        }
    }

    if (!from) return null;

    // 计算目标坐标
    if (action === "平") {
        to = { x: destIndex, y: from.y };
    } else if (action === "进") {
        const dy = isRed ? -1 : 1;
        if (["兵", "卒"].includes(pieceChar) || ["马", "象", "相", "士", "仕"].includes(pieceChar)) {
            // 马、兵进斜线：目标 x = destIndex, y +-1
            to = { x: destIndex, y: from.y + dy };
        } else {
            to = { x: from.x, y: from.y + (destIndex + 1) * dy };
        }
    } else if (action === "退") {
        const dy = isRed ? 1 : -1;
        if (["兵", "卒"].includes(pieceChar) || ["马", "象", "相", "士", "仕"].includes(pieceChar)) {
            to = { x: destIndex, y: from.y + dy };
        } else {
            to = { x: from.x, y: from.y + (destIndex + 1) * dy };
        }
    }

    if (!to) return null;

    // 镜像还原坐标
    const finalFrom = {
        x: flipX(from.x),
        y: flipY(from.y),
    };
    const finalTo = {
        x: flipX(to.x),
        y: flipY(to.y),
    };

    return { from: finalFrom, to: finalTo };
}

export function genFENFromBoard(board: IBoard, turn: ITurn): string {
    // board[x][y]，x为列，y为行
    const rows: string[] = [];
    for (let y = 0; y < 10; y++) {
        let fenRow = "";
        let empty = 0;
        for (let x = 0; x < 9; x++) {
            const cell = board[x][y];
            if (!cell) {
                empty++;
            } else {
                if (empty > 0) {
                    fenRow += empty;
                    empty = 0;
                }
                fenRow += cell;
            }
        }
        if (empty > 0) fenRow += empty;
        rows.push(fenRow);
    }
    const fen = rows.join("/");
    return `${fen} ${turn === "red" ? "w" : "b"}`;
}
