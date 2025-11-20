export type TokenType =
    // | 'step'        // 着法序号 "1."
    | 'iccs-move'   // ICCS着法 "H2-E2"
    | 'wxf-move'    // 中文着法 "炮二平五"
    | 'left-paren'  // "("
    | 'right-paren' // ")"
    | 'comment'     // 注释
    | 'tag'         // 标签
    | 'result'      // 结果 "1-0","1/2-1/2"
    | 'eof';        // 结束

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

    const peek = () => pgn[pos];
    const consume = () => {
        const char = pgn[pos++];
        if (char === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
        return char;
    };

    while (pos < pgn.length) {
        const startPos = pos;
        const startLine = line;
        const startCol = column;

        const char = peek();

        // 跳过空白
        if (/\s/.test(char)) {
            consume();
            continue;
        }

        // 跳过...
        if (char === '.') {
            while (peek() === '.') {
                consume();
            }
            continue;
        }

        // 着法序号 (1. )
        if (/\d/.test(char)) {
            let value = consume();
            while (peek() === '.') {
                value += consume();
            }
            // tokens.push({ type: "step", value, line: s`tartLine, column: startCol });
            continue;
        }

        // ICCS着法 (A1-A2格式)，支持大小写字母
        if (/[a-iA-I]/.test(char)) {
            let value = consume().toUpperCase(); // 首字母转大写

            if (/\d/.test(peek())) {
                value += consume();

                if (peek() === '-') {
                    value += consume();

                    if (/[a-iA-I]/.test(peek())) {
                        value += consume().toUpperCase(); // 目标字母也转大写

                        if (/\d/.test(peek())) {
                            value += consume();
                            tokens.push({ type: "iccs-move", value, line: startLine, column: startCol });
                            continue;
                        }
                    }
                }
            }

            // 回退
            pos = startPos;
            line = startLine;
            column = startCol;
        }

        // 在tokenize函数中修改中文着法识别逻辑
        if (/[兵卒车马炮相士帅将]/.test(char)) {
            let value = consume();
            // 支持更多中文象棋术语
            while (/[一二三四五六七八九123456789进退平前后左右]/.test(peek()) && pos < pgn.length) {
                value += consume();
            }
            tokens.push({ type: "wxf-move", value, line: startLine, column: startCol });
            continue;
        }
        // 括号
        if (char === '(') {
            tokens.push({ type: "left-paren", value: consume(), line: startLine, column: startCol });
            continue;
        }
        if (char === ')') {
            tokens.push({ type: "right-paren", value: consume(), line: startLine, column: startCol });
            continue;
        }

        // 注释
        if (char === '{') {
            let value = consume();
            while (peek() !== '}' && pos < pgn.length) {
                value += consume();
            }
            if (peek() === '}') {
                value += consume();
                tokens.push({ type: "comment", value, line: startLine, column: startCol });
                continue;
            }
        }

        // 标签
        if (char === '[') {
            let value = consume();
            while (peek() !== ']' && pos < pgn.length) {
                value += consume();
            }
            if (peek() === ']') {
                value += consume();
                tokens.push({ type: "tag", value, line: startLine, column: startCol });
                continue;
            }
        }

        if (char === '*') {
            tokens.push({ type: 'result', value: '*', line: startLine, column: startCol });
            consume();
            continue;
        }
        // 未知字符
        throw new Error(`无法识别的字符 '${char}' 在行 ${line}, 列 ${column}`);
    }

    tokens.push({ type: "eof", value: "", line, column });
    return tokens;
}