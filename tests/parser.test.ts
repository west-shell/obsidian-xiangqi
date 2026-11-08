import { describe, expect, test } from "vitest";

import { PGNParser } from "../src/modules/Source/parser";
import { extractHeaders, splitPGN } from "../src/modules/Source/parse";

describe("中国象棋PGN解析器", () => {
  test("解析简单着法序列", () => {
    const pgn = `
      [Event "测试棋局"]
      1. H2-E2 H7-E7
      2. I0-H0 B7-C7
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(gameTree.id).toBe("node-root");
    expect(gameTree.children).toHaveLength(1);

    const move1 = gameTree.children[0];
    expect(move1.move?.zh).toBeTruthy();
    expect(move1.color).toBe("white");
    expect(move1.step).toBe(1);
    expect(move1.children).toHaveLength(1);
    expect(move1.fen).toBeTruthy();

    const move2 = move1.children[0];
    expect(move2.move?.zh).toBeTruthy();
    expect(move2.color).toBe("black");
    expect(move2.step).toBe(2);
    expect(move2.fen).toBeTruthy();
  });

  test("解析带注释的着法", () => {
    const pgn = `
      1. H2-E2 {这是关键着法} H7-E7
      2. I0-H0  B7-C7
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();

    const redMove = gameTree.children[0];
    expect(redMove.comments).toEqual(["这是关键着法"]);

    const blackMove = redMove.children[0];
    expect(blackMove.comments).toEqual([]);
  });

  test("解析分支变化", () => {
    const pgn = `
      1. H2-E2 (H0-G2 {变着}) H7-E7
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    const mainLine = gameTree.children[0];

    expect(mainLine.move?.zh).toBeTruthy();
    expect(mainLine.children).toHaveLength(1);

    expect(gameTree.children.length).toBeGreaterThan(1);
    const variation = gameTree.children[1];
    expect(variation.move?.zh).toBeTruthy();
    expect(variation.comments).toEqual(["变着"]);
  });

  test("解析私有标注与研究字形NAG", () => {
    const pgn = "1. H2-E2 {#a:bm} $16 H7-E7 $17";
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();

    const redMove = gameTree.children[0];
    expect(redMove.annotations).toEqual(["bm", "16"]);

    const blackMove = redMove.children[0];
    expect(blackMove.annotations).toEqual(["17"]);
  });

  test("旧版#a:自定义键迁移为NAG标注键", () => {
    const pgn = "1. H2-E2 {#a:+} H7-E7 {#a:-} 2. B0-C2 {#a:=} H9-G7";
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();

    expect(gameTree.children[0].annotations).toEqual(["16"]);
    expect(gameTree.children[0].children[0].annotations).toEqual(["17"]);
    expect(gameTree.children[0].children[0].children[0].annotations).toEqual([
      "10",
    ]);
  });

  test("解析中文着法序列", () => {
    const pgn = `
      [Event "测试棋局"]
      1. 炮二平五 马8进7
      2. 马二进三 车9平8
      3. 车一平二
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    const move1 = gameTree.children[0];
    expect(move1.move?.iccs).toBe("H2-E2");
    expect(move1.move?.zh).toBe("炮二平五");
    expect(move1.color).toBe("white");

    const move2 = move1.children[0];
    expect(move2.move?.iccs).toBe("H9-G7");
    expect(move2.color).toBe("black");

    const move3 = move2.children[0];
    expect(move3.move?.iccs).toBe("H0-G2");

    const move4 = move3.children[0];
    expect(move4.move?.iccs).toBe("I9-H9");

    const move5 = move4.children[0];
    expect(move5.move?.iccs).toBe("I0-H0");
  });

  test("解析全角数字与繁体字着法", () => {
    const pgn = "1. 炮２平５ 馬８进７ 2. 傌八进七";
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    expect(gameTree.children[0].move?.iccs).toBe("H2-E2");
    expect(gameTree.children[0].children[0].move?.iccs).toBe("H9-G7");
    expect(gameTree.children[0].children[0].children[0].move?.iccs).toBe(
      "B0-C2",
    );
  });

  test("解析ICCS与中文混排棋谱", () => {
    const pgn = "1. H2-E2 马8进7 2. 马二进三 车9平8";
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    expect(gameTree.children[0].move?.iccs).toBe("H2-E2");
    expect(gameTree.children[0].children[0].move?.iccs).toBe("H9-G7");
    expect(gameTree.children[0].children[0].children[0].move?.iccs).toBe(
      "H0-G2",
    );
    expect(
      gameTree.children[0].children[0].children[0].children[0].move?.iccs,
    ).toBe("I9-H9");
  });

  test("解析前后炮消歧与FEN起始局面", () => {
    const pgn = `
      [FEN "r1bakab1r/9/1c7/4p4/9/7C1/9/7C1/9/1NBAKABN1 w - - 0 1"]
      1. 前炮进四 卒5进1 2. 后炮进四
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    const move1 = gameTree.children[0];
    expect(move1.move?.iccs).toBe("H4-H8");
    expect(move1.children[0].move?.iccs).toBe("E6-E5");
    expect(move1.children[0].children[0].move?.iccs).toBe("H2-H6");
  });

  test("中文着法分支变化与注释", () => {
    const pgn = "1. 炮二平五 {当头炮} (马二进三 {变着}) 马8进7";
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();

    const mainLine = gameTree.children[0];
    expect(mainLine.move?.zh).toBe("炮二平五");
    expect(mainLine.comments).toEqual(["当头炮"]);

    expect(gameTree.children).toHaveLength(2);
    const variation = gameTree.children[1];
    expect(variation.move?.iccs).toBe("H0-G2");
    expect(variation.comments).toEqual(["变着"]);
  });
});

describe("中文tag别名识别", () => {
  test("extractHeaders 将中文tag键映射为标准键", () => {
    const raw = [
      '[赛事 "碧桂园杯"]',
      '[红方 "王天一"]',
      '[黑方 "郑惟桐"]',
      '[结果 "红胜"]',
      '[日期 "2026.01.01"]',
    ].join("\n");
    const headers = extractHeaders(raw);
    expect(headers.get("Event")).toBe("碧桂园杯");
    expect(headers.get("Red")).toBe("王天一");
    expect(headers.get("Black")).toBe("郑惟桐");
    expect(headers.get("Result")).toBe("1-0");
    expect(headers.get("Date")).toBe("2026.01.01");
  });

  test("显式标准键优先于中文别名（无论出现顺序）", () => {
    const aliasFirst = extractHeaders('[红方 "甲"]\n[Red "乙"]');
    expect(aliasFirst.get("Red")).toBe("乙");
    const explicitFirst = extractHeaders('[Red "乙"]\n[红方 "甲"]');
    expect(explicitFirst.get("Red")).toBe("乙");
  });

  test('[结果 "红胜"] 无着法终止符时结果落到主线末端', () => {
    const pgn = ['[结果 "红胜"]', "", "1. H2-E2 H7-E7"].join("\n");
    let tip = new PGNParser(pgn).getRoot();
    while (tip.children.length > 0) tip = tip.children[0];
    expect(tip.result).toBe("1-0");
  });

  test('[结果 "和棋"] 映射为 1/2-1/2', () => {
    const headers = extractHeaders('[结果 "和棋"]');
    expect(headers.get("Result")).toBe("1/2-1/2");
  });

  test("getTags 保留原始中文键（保存回写安全）", () => {
    const pgn = '[红方 "王天一"]\n\n1. H2-E2 H7-E7';
    const serialized = new PGNParser(pgn).getTags();
    expect(serialized).toContain('[红方 "王天一"]');
    expect(serialized).not.toContain("[Red");
  });

  test("splitPGN 正确切分仅含中文tag的多局棋谱", () => {
    const pgn = [
      '[红方 "甲"]',
      "",
      "1. H2-E2 H7-E7",
      "",
      '[红方 "乙"]',
      "",
      "1. H0-G2 H9-G7",
    ].join("\n");
    const slots = splitPGN(pgn);
    expect(slots).toHaveLength(2);
    expect(slots[0].headers.get("Red")).toBe("甲");
    expect(slots[1].headers.get("Red")).toBe("乙");
  });
});
