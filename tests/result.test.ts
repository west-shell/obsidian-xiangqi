import { describe, expect, test } from "vitest";

import { getAutoResult } from "../src/chess";
import { PGNParser } from "../src/modules/Source/parser";
import type { ChessNode } from "../src/types";
import { branchTip, migrateBranchResult } from "../src/utils/result";
import { stringifyPGN } from "../src/utils/stringify-pgn";

function makeNode(id: string, result?: string): ChessNode {
  return {
    id,
    fen: "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
    move: null,
    color: null,
    children: [],
    comments: [],
    result,
  };
}

describe("getAutoResult", () => {
  test("checkmate against black forces 1-0", () => {
    // 将 e0 checked by 车 e1 (protected by 车 e8); d0/f0 covered by the
    // neighbouring rooks — the bare king has no escape.
    expect(getAutoResult("4k4/3RRR3/9/9/9/9/9/9/4R4/4K4 b")).toBe("1-0");
  });

  test("checkmate against red forces 0-1", () => {
    expect(getAutoResult("4k4/4r4/9/9/9/9/9/9/3rrr3/4K4 w")).toBe("0-1");
  });

  test("stalemate (困毙) loses for the stranded side", () => {
    // 黑将 e0 is not in check but d0/f0/e1 are all covered by the two
    // red pawns — black has no legal move and loses.
    expect(getAutoResult("4k4/3P1P3/9/9/9/9/9/9/9/3K5 b")).toBe("1-0");
  });

  test("ongoing positions and invalid FENs return null", () => {
    expect(
      getAutoResult(
        "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w",
      ),
    ).toBeNull();
    expect(getAutoResult("not a fen")).toBeNull();
  });
});

describe("branchTip", () => {
  test("follows the first-child chain to the line's last node", () => {
    const parser = new PGNParser("1. H2-E2 (H0-G2) H7-E7 2. H0-G2");
    const root = parser.getRoot();
    // Mainline continues H7-E7 → H0-G2, not into the H0-G2 variation.
    expect(root.children).toHaveLength(2);
    expect(branchTip(root).id).toBe(
      root.children[0].children[0].children[0].id,
    );
    const midNode = root.children[0];
    expect(branchTip(midNode).id).toBe(midNode.children[0].children[0].id);
  });

  test("returns the node itself when the line has no moves past it", () => {
    const parser = new PGNParser("1. H2-E2 H7-E7");
    const root = parser.getRoot();
    const tip = branchTip(root);
    expect(tip.children).toHaveLength(0);
    expect(tip.id).toBe(root.children[0].children[0].id);
  });
});

describe("migrateBranchResult", () => {
  test("extending the line (first child) carries the result to the new tip", () => {
    const parent = makeNode("p", "1-0");
    const child = makeNode("c");
    parent.children.push(child);
    migrateBranchResult(parent, child);
    expect(parent.result).toBeUndefined();
    expect(child.result).toBe("1-0");
  });

  test("a new variation (second child) never inherits the result", () => {
    // A parent that keeps its result while already having a line going
    // (mid-line result): opening a second variation must not carry the
    // result over — only the first-child extension does.
    const parent = makeNode("p", "1-0");
    const first = makeNode("c1");
    parent.children.push(first);
    const second = makeNode("c2");
    parent.children.push(second);
    migrateBranchResult(parent, second);
    expect(parent.result).toBe("1-0");
    expect(first.result).toBeUndefined();
    expect(second.result).toBeUndefined();
  });

  test("does nothing when the parent carries no result", () => {
    const parent = makeNode("p");
    const child = makeNode("c");
    parent.children.push(child);
    migrateBranchResult(parent, child);
    expect(parent.result).toBeUndefined();
    expect(child.result).toBeUndefined();
  });
});

describe("per-branch result serialization", () => {
  test("result on a branch tip round-trips through stringify/parse", () => {
    const parser = new PGNParser("1. H2-E2 H7-E7 2. H0-G2 H9-G7");
    const root = parser.getRoot();
    branchTip(root).result = "1/2-1/2";
    const out = stringifyPGN(root);
    expect(out).toContain("1/2-1/2");
    const reRoot = new PGNParser(out).getRoot();
    expect(branchTip(reRoot).result).toBe("1/2-1/2");
  });

  test("variation and mainline keep independent results", () => {
    const parser = new PGNParser("1. H2-E2 (H0-G2) H7-E7");
    const root = parser.getRoot();
    branchTip(root).result = "1-0";
    // Variation tip: root's second child H0-G2.
    const variation = root.children[1];
    branchTip(variation).result = "0-1";
    const out = stringifyPGN(root);
    const reRoot = new PGNParser(out).getRoot();
    expect(branchTip(reRoot).result).toBe("1-0");
    expect(branchTip(reRoot.children[1]).result).toBe("0-1");
  });

  test("a result on a mid-line node is not serialized", () => {
    const parser = new PGNParser("1. H2-E2 H7-E7");
    const root = parser.getRoot();
    // Documented constraint: only leaf results serialize, which is why
    // set-result targets the branch tip.
    root.children[0].result = "1-0";
    const out = stringifyPGN(root);
    expect(out).not.toContain("1-0");
    expect(out.trimEnd().endsWith("*")).toBe(true);
  });
});
