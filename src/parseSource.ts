export function parseSource(source: string): {
    pieces: { type: string; x: number; y: number }[];
    board: (string | null)[][];
    moves: string[];
    firstTurn: 'black' | 'red';
} { // 1. 提取FEN（优先从提示词中提取）
    let fen = (source.match(/\[fen\s+"([^"]*)"\]/i)?.[1]  // 先尝试匹配[fen "xxx"]格式
        || source.match(/([rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+/)?.[0]// 再尝试匹配纯FEN+回合格式
        || "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR" // 默认初始局面
    );

    // 2. 提取最后一段走法（去掉注释和换行）
    const moveSection = source.split(/\n\s*\n/).pop() || ""; // 取最后一段
    const moves = moveSection
        .split(/\s+/) // 按空格分割
        .filter(token => /^[A-Z][0-9]-[A-Z][0-9]$/.test(token)); // 过滤合法走法（如 H2-D2）

    const board: (string | null)[][] = Array.from({ length: 10 }, () => Array(9).fill(null));
    const pieces: { type: string; x: number; y: number }[] = [];
    const [position, turn] = fen.trim().split(/\s+/);

    const rows = position.split('/');
    rows.forEach((row, y) => {
        let x = 0;
        for (const char of row) {
            if (/[1-9]/.test(char)) {
                x += parseInt(char);
            } else if (/[a-zA-Z]/.test(char)) {
                board[x][y] = char;
                pieces.push({ type: char, x, y });
                x++;
            }
        }
    });
    const firstTurn = turn === 'b' ? 'black' : 'red';

    return {
        board,
        moves,
        pieces,
        firstTurn
    };
}