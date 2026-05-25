export type TokenType =
    | "iccs-move"
    | "wxf-move"
    | "left-paren"
    | "right-paren"
    | "comment"
    | "tag"
    | "result"
    | "eof";

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

export function tokenize(pgn: string): Token[] {
    const tokens: Token[] = [];
    let line = 1;
    let column = 1;
    let pos = 0;

    const advance = (n: number) => {
        while (n-- > 0) {
            const c = pgn[pos++];
            if (c === "\n") {
                line++;
                column = 1;
            } else {
                column++;
            }
        }
    };

    const matchAndConsume = (regex: RegExp): string | null => {
        const match = regex.exec(pgn.slice(pos));
        if (!match) return null;
        const value = match[0];
        advance(value.length);
        return value;
    };

    while (pos < pgn.length) {
        const startLine = line;
        const startCol = column;
        const rest = pgn.slice(pos);
        const char = rest[0];

        // 跳过空白
        if (/^\s/.test(rest)) {
            advance(1);
            continue;
        }

        // 跳过着法序号及 ...
        const step = matchAndConsume(/^\d+\.(\s*\.\.\.)?/);
        if (step) {
            continue;
        }

        // ICCS Move: A0-B9
        const iccs = matchAndConsume(/^[A-Ia-i][0-9][\-x\*][A-Ia-i][0-9]/);
        if (iccs) {
            tokens.push({ type: "iccs-move", value: iccs.toUpperCase(), line: startLine, column: startCol });
            continue;
        }

        // 中文 WXF 着法
        const wxf = matchAndConsume(/^[兵卒车马炮相士帅将][一二三四五六七八九123456789进退平前后左右]*/);
        if (wxf) {
            tokens.push({ type: "wxf-move", value: wxf, line: startLine, column: startCol });
            continue;
        }

        // 注释 { ... }，支持嵌套大括号（如 JSON 数据）
        if (char === "{") {
            let depth = 1;
            let end = pos + 1;
            while (end < pgn.length && depth > 0) {
                if (pgn[end] === "{") depth++;
                else if (pgn[end] === "}") depth--;
                end++;
            }
            const comment = pgn.slice(pos, end);
            advance(end - pos);
            tokens.push({ type: "comment", value: comment, line: startLine, column: startCol });
            continue;
        }

        // 标签 [ ... ]
        const tag = matchAndConsume(/^\[[^\]]*\]/);
        if (tag) {
            tokens.push({ type: "tag", value: tag, line: startLine, column: startCol });
            continue;
        }

        // 结果
        const result = matchAndConsume(/^(1-0|0-1|1\/2-1\/2|\*)/);
        if (result) {
            tokens.push({ type: "result", value: result, line: startLine, column: startCol });
            continue;
        }

        // 左括号
        if (char === "(") {
            advance(1);
            tokens.push({ type: "left-paren", value: "(", line: startLine, column: startCol });
            continue;
        }

        // 右括号
        if (char === ")") {
            advance(1);
            tokens.push({ type: "right-paren", value: ")", line: startLine, column: startCol });
            continue;
        }

        // 尝试识别FEN字符串
        const fen = matchAndConsume(/^[rnbakcpRNBAKCP1-9]+(\/[rnbakcpRNBAKCP1-9]+){8}(\s+[wb])?/);
        if (fen) {
            // 将FEN转换为标签格式
            tokens.push({ type: "tag", value: `[FEN "${fen}"]`, line: startLine, column: startCol });
            continue;
        }

        // 其他无法识别的字符 → 跳过（不再抛出错误）
        advance(1);
    }

    tokens.push({ type: "eof", value: "", line, column });
    return tokens;
}
