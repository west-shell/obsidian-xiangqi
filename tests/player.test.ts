import { describe, expect, test } from "vitest";

import { PRIMARY_PLAYER_KEY } from "../src/chess";
import type { ChessNode, NodeMap } from "../src/types";
import {
  clockForColor,
  formatClock,
  formatSeconds,
  getPlayerInfo,
  initialClockSeconds,
} from "../src/utils/player";

function headersOf(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

function node(
  id: string,
  parentID: string | null,
  color: "white" | "black" | null,
  clock?: string,
): ChessNode {
  return {
    id,
    fen: "",
    move: null,
    color,
    parentID,
    children: [],
    clock,
  };
}

describe("player info from headers", () => {
  test("reads first and second player with title and rating", () => {
    const headers = headersOf({
      [PRIMARY_PLAYER_KEY]: "Carlsen",
      [`${PRIMARY_PLAYER_KEY}Title`]: "GM",
      [`${PRIMARY_PLAYER_KEY}Elo`]: "2885",
      Black: "Nepomniachtchi",
      BlackTitle: "GM",
      BlackElo: "2768",
    });
    expect(getPlayerInfo(headers, true)).toEqual({
      name: "Carlsen",
      title: "GM",
      rating: "2885",
    });
    expect(getPlayerInfo(headers, false)).toEqual({
      name: "Nepomniachtchi",
      title: "GM",
      rating: "2768",
    });
  });

  test("'?' and missing headers are filtered out", () => {
    const headers = headersOf({
      [PRIMARY_PLAYER_KEY]: "?",
      Black: "Anonymous",
    });
    expect(getPlayerInfo(headers, true)).toEqual({});
    expect(getPlayerInfo(headers, false)).toEqual({ name: "Anonymous" });
  });

  test("undefined headers yield empty info", () => {
    expect(getPlayerInfo(undefined, true)).toEqual({});
  });
});

describe("initial clock from [TimeControl]", () => {
  test("sudden death with increment", () => {
    expect(initialClockSeconds(headersOf({ TimeControl: "300+0" }))).toBe(300);
    expect(initialClockSeconds(headersOf({ TimeControl: "600+5" }))).toBe(600);
  });

  test("moves per period keeps the last period base", () => {
    expect(initialClockSeconds(headersOf({ TimeControl: "40/7200+30" }))).toBe(
      7200,
    );
  });

  test("untimed and unknown forms are rejected", () => {
    expect(
      initialClockSeconds(headersOf({ TimeControl: "-" })),
    ).toBeUndefined();
    expect(
      initialClockSeconds(headersOf({ TimeControl: "?" })),
    ).toBeUndefined();
    expect(
      initialClockSeconds(headersOf({ TimeControl: "15d10+5" })),
    ).toBeUndefined();
    expect(initialClockSeconds(headersOf({}))).toBeUndefined();
    expect(
      initialClockSeconds(headersOf({ TimeControl: "0+0" })),
    ).toBeUndefined();
  });
});

describe("clock for color at a node", () => {
  const root = node("root", null, null);
  const w1 = node("w1", "root", "white", "0:05:00");
  const b1 = node("b1", "w1", "black", "0:04:50");
  const w2 = node("w2", "b1", "white", "0:04:40");
  const nodeMap: NodeMap = new Map([
    ["root", root],
    ["w1", w1],
    ["b1", b1],
    ["w2", w2],
  ]);

  test("each side reports its own most recent clock", () => {
    expect(clockForColor(w2, nodeMap, "white")).toBe("0:04:40");
    expect(clockForColor(w2, nodeMap, "black")).toBe("0:04:50");
    expect(clockForColor(b1, nodeMap, "white")).toBe("0:05:00");
    expect(clockForColor(b1, nodeMap, "black")).toBe("0:04:50");
  });

  test("root has no clock", () => {
    expect(clockForColor(root, nodeMap, "white")).toBeUndefined();
  });

  test("branch without clock falls back to the parent branch", () => {
    const w2b = node("w2b", "b1", "white");
    const map2: NodeMap = new Map(nodeMap).set("w2b", w2b);
    expect(clockForColor(w2b, map2, "white")).toBe("0:05:00");
    expect(clockForColor(w2b, map2, "black")).toBe("0:04:50");
  });
});

describe("clock formatting", () => {
  test("hours are stripped below one hour", () => {
    expect(formatClock("0:05:00")).toBe("5:00");
    expect(formatClock("0:00:59")).toBe("0:59");
    expect(formatClock("1:30:00")).toBe("1:30:00");
  });

  test("non-clock strings pass through unchanged", () => {
    expect(formatClock("hello")).toBe("hello");
  });

  test("seconds render in the same display form", () => {
    expect(formatSeconds(300)).toBe("5:00");
    expect(formatSeconds(90)).toBe("1:30");
    expect(formatSeconds(5400)).toBe("1:30:00");
  });
});
