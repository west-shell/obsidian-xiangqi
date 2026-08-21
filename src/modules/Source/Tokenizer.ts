import {
  FEN_REGEX,
  getMoveTokenType,
  MOVE_REGEX,
  type MoveTokenType,
} from "../../chess";

export type TokenType =
  | MoveTokenType
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

    if (/^\s/.test(rest)) {
      advance(1);
      continue;
    }

    const step = matchAndConsume(/^\d+\.(\s*\.\.\.)?/);
    if (step) {
      continue;
    }

    const move = matchAndConsume(MOVE_REGEX);
    if (move) {
      tokens.push({
        type: getMoveTokenType(move),
        value: move,
        line: startLine,
        column: startCol,
      });
      continue;
    }

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
      tokens.push({
        type: "comment",
        value: comment,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    const tag = matchAndConsume(/^\[[^\]]*\]/);
    if (tag) {
      tokens.push({
        type: "tag",
        value: tag,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    const result = matchAndConsume(/^(1-0|0-1|1\/2-1\/2|\*)/);
    if (result) {
      tokens.push({
        type: "result",
        value: result,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    if (char === "(") {
      advance(1);
      tokens.push({
        type: "left-paren",
        value: "(",
        line: startLine,
        column: startCol,
      });
      continue;
    }

    if (char === ")") {
      advance(1);
      tokens.push({
        type: "right-paren",
        value: ")",
        line: startLine,
        column: startCol,
      });
      continue;
    }

    const fen = matchAndConsume(FEN_REGEX);
    if (fen) {
      tokens.push({
        type: "tag",
        value: `[FEN "${fen}"]`,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    advance(1);
  }

  tokens.push({ type: "eof", value: "", line, column });
  return tokens;
}
