import { describe, expect, test } from "vitest";

import { PGNParser } from "./parser";

describe("Chess PGN Parser", () => {
  test("parse simple move sequence", () => {
    const pgn = `
      [Event "Test Game"]
      1. e4 e5
      2. Nf3 Nc6
    `;

    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(gameTree.id).toBe("node-root");
    expect(gameTree.children).toHaveLength(1);

    const move1 = gameTree.children[0];
    expect(move1.move?.san).toBe("e4");
    expect(move1.side).toBe("white");
    expect(move1.step).toBe(1);
    expect(move1.children).toHaveLength(1);
    expect(move1.fen).toBeTruthy();

    const move2 = move1.children[0];
    expect(move2.move?.san).toBe("e5");
    expect(move2.side).toBe("black");
    expect(move2.step).toBe(2);
    expect(move2.fen).toBeTruthy();
  });

  test("parse moves with comments", () => {
    const pgn = `
      1. e4 {A key move} e5
      2. Nf3 Nc6
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();

    const whiteMove = gameTree.children[0];
    expect(whiteMove.comments).toEqual(["A key move"]);

    const blackMove = whiteMove.children[0];
    expect(blackMove.comments).toEqual([]);
  });

  test("parse variations", () => {
    const pgn = `
      1. e4 (1. d4 {Alternative} d5) e5
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    const mainLine = gameTree.children[0];

    expect(mainLine.move?.san).toBe("e4");
    expect(mainLine.children).toHaveLength(1);

    const variation = gameTree.children[1];
    expect(variation.children).toHaveLength(1);
    expect(variation.move?.san).toBe("d4");
    expect(variation.comments).toEqual(["Alternative"]);
  });

  // ============ FEN 解析测试 ============

  test("parse FEN tag and use it as root fen", () => {
    const pgn = `
      [FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]
      1. Ke2 Kd7
    `;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    // First move should be from the custom position
    const move1 = parser.getRoot().children[0];
    expect(move1.move?.san).toBe("Ke2");
  });

  test("parse FEN with en passant", () => {
    const pgn = `
      [FEN "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2"]
      1. ... e5
    `;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2",
    );
  });

  test("parse FEN with no castling available", () => {
    const pgn = `
      [FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"]
      1. e4
    `;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
    );
  });

  test("default fen when no FEN tag provided", () => {
    const pgn = `
      1. e4 e5
    `;
    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(false);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  test('raw FEN in source (without [FEN "..."] tag) is recognized', () => {
    // This simulates what tokenizer does: raw FEN without [FEN "..."] wrapper
    const pgn = `4k3/8/8/8/8/8/8/4K3 w - - 0 1

1. e4 e5`;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  });

  test("raw FEN with en passant in source is recognized", () => {
    const pgn = `rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2

1. ... e5`;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2",
    );
  });

  test("invalid FEN (missing kings) should NOT set haveFEN", () => {
    const pgn = `
      [FEN "7q/8/2R5/6R1/8/8/8/3Q4 w - - 0 1"]
      1. Ra6
    `;

    const parser = new PGNParser(pgn);
    // chess.js rejects this FEN (missing both kings)
    expect(parser.haveFEN).toBe(false);
    // rootNode.fen should remain DEFAULT_FEN
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });
});
