import { describe, expect, test } from "vitest";

import { extractHeaders, splitPGN } from "../utils/parse";

describe("splitPGN", () => {
  test("single game returns one slot", () => {
    const pgn = `[Event "Test"]
[White "Carlsen"]
[Black "Anand"]
1. e4 e5 2. Nf3 Nc6 *`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(1);
    expect(games[0].headers.get("Event")).toBe("Test");
    expect(games[0].headers.get("White")).toBe("Carlsen");
  });

  test("two games separated by tags", () => {
    const pgn = `[Event "Game 1"]
1. e4 e5 *

[Event "Game 2"]
1. d4 d5 *`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(2);
    expect(games[0].headers.get("Event")).toBe("Game 1");
    expect(games[1].headers.get("Event")).toBe("Game 2");
  });

  test("games without result token", () => {
    const pgn = `[Event "Game 1"]
1. e4 e5

[Event "Game 2"]
1. d4 d5`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(2);
    expect(games[0].headers.get("Event")).toBe("Game 1");
    expect(games[1].headers.get("Event")).toBe("Game 2");
  });

  test("game with only tags no moves", () => {
    const pgn = `[Event "Empty Game"]
[White "?"]
[Black "?"]

[Event "Real Game"]
1. e4 e5`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(2);
    expect(games[0].headers.get("Event")).toBe("Empty Game");
    expect(games[1].headers.get("Event")).toBe("Real Game");
  });

  test("empty string returns one empty slot", () => {
    const games = splitPGN("");
    expect(games).toHaveLength(1);
  });

  test("game with FEN tag", () => {
    const pgn = `[Event "Custom Start"]
[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]
1. Ke2

[Event "Normal Start"]
1. e4`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(2);
    expect(games[0].headers.get("FEN")).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(games[1].headers.get("Event")).toBe("Normal Start");
  });

  test("comment with tag-like content does not split", () => {
    const pgn = `[Event "Test"]
1. e4 {[SomeTag "value"]} e5`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(1);
    expect(games[0].headers.get("Event")).toBe("Test");
  });

  test("three games in sequence", () => {
    const pgn = `[Event "G1"]
1. e4 *

[Event "G2"]
1. d4 *

[Event "G3"]
1. c4 *`;

    const games = splitPGN(pgn);
    expect(games).toHaveLength(3);
    expect(games[0].headers.get("Event")).toBe("G1");
    expect(games[1].headers.get("Event")).toBe("G2");
    expect(games[2].headers.get("Event")).toBe("G3");
  });
});

describe("extractHeaders", () => {
  test("extracts standard tags", () => {
    const raw = `[Event "WCC"]
[Site "London"]
[Date "2014.11.07"]
[White "Carlsen"]
[Black "Anand"]
[Result "1-0"]
1. e4 e5`;

    const headers = extractHeaders(raw);
    expect(headers.get("Event")).toBe("WCC");
    expect(headers.get("White")).toBe("Carlsen");
    expect(headers.get("Black")).toBe("Anand");
    expect(headers.get("Result")).toBe("1-0");
  });

  test("empty string returns empty map", () => {
    const headers = extractHeaders("");
    expect(headers.size).toBe(0);
  });

  test("movetext without tags returns empty map", () => {
    const headers = extractHeaders("1. e4 e5 2. Nf3");
    expect(headers.size).toBe(0);
  });
});
