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

  test("解析含退着的整局中文棋谱（百变象棋谱·八阵图）", () => {
    const pgn = `[Game "Chinese Chess"]
[Event "百变象棋谱"]
[Title "八阵图(《百变象棋谱》第1局)"]
[Result "*"]
[FEN "2bak3C/4a4/4b4/3P3R1/9/6R2/9/3p1p3/4K4/3r1r3 w - - 0 1"]

1. 车三进五 士５退６ 2. 车三退一 士６进５ 3. 车二进三 士５退６
4. 车三平五 士４进５ 5. 车二退一 象５退７ 6. 车二平五 将５平４
7. 车五进一 将４进１ 8. 兵六进一 将４进１ 9. 车五平六 *`;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    let tip = gameTree;
    let count = 0;
    while (tip.children.length > 0) {
      tip = tip.children[0];
      count++;
    }
    expect(count).toBe(17);
    expect(tip.move?.zh).toBe("车五平六");
  });

  test("解析将军局面下前后缀消歧的整局棋谱（百变象棋谱·二十八宿闹昆阳）", () => {
    const pgn = `[Game "Chinese Chess"]
[Event "百变象棋谱"]
[Site "https://xiangqiai.com"]
[Round "2"]
[Title "二十八宿闹昆阳(《百变象棋谱》第2局)"]
[Result "*"]
[FEN "5a3/4aP3/b2kb1NC1/1P4p2/9/N1p1cp3/4c4/2p1R1p2/2nrRrn2/2BAKAB2 w - - 0 1"]

1. 马九进七 将４退１ 2. 马三进四 士５退６ 3. 马七进八 将４退１ 4. 炮二进二 士６进５ 5. 兵四进一 象５退７ 6. 兵四平三 士５退６
7. 兵三平四 后炮退５ 8. 兵四平五 将４平５ 9. 前车进一 将５平６ 10. 前车进六 将６进１ 11. 后车进七 将６进１ 12. 前车平四 *`;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    // 第 7 回合黑方被将军，后炮退５（e4-e9 垫炮）是唯一合法应着，
    // 前/后消歧须依据棋盘位置而非合法走法列表
    let node = gameTree;
    for (let i = 0; i < 14; i++) node = node.children[0];
    expect(node.move?.zh).toBe("后炮退５");
    expect(node.move?.iccs).toBe("E4-E9");

    let tip = gameTree;
    let count = 0;
    while (tip.children.length > 0) {
      tip = tip.children[0];
      count++;
    }
    expect(count).toBe(23);
    expect(tip.move?.zh).toBe("前车平四");
  });

  test("解析多卒序数与前后中消歧的整局棋谱（百变象棋谱·廉蔺争功(改图2)）", () => {
    const pgn = `[Game "Chinese Chess"]
[Event "百变象棋谱"]
[Site "https://xiangqiai.com"]
[Round "13"]
[Title "廉蔺争功(改图2)(《百变象棋谱》第13局)"]
[Result "*"]
[FEN "3a1k3/4a4/4b3R/4p4/6b2/2pc5/4P4/2p1B3R/4p4/3K5 w - - 0 1"]
[GameId "01a1829d-b17b-7662-8028-12947635d831"]
[Source "xiangqiai.com official ancient collection"]

1. 后车平四 将６平５ 2. 车一进二 象５退７ 3. 车一平三 士５退６ 4. 车四进七 ( 4. 车三平四 将５进１ 5. 后车进六 将５进１
6. 前车平五 将５平４ 7. 车五平六 将４平５ 8. 车六退五 二卒平４ 9. 车四平六 卒３平４ 10. 车六退四 卒４进１ 11. 车六退三 前卒平４
12. 帅六进一 ) 将５进１ 5. 车四平五 将５平４ 6. 车五平六 将４平５ 7. 车三平五 将５平６ 8. 车六退一 ( 8. 车五平四 将６平５
9. 车四退八 三卒平６ 10. 相五进七 ( 10. 帅六进一 炮４平８ 11. 相五进七 炮８进３ 12. 帅六退一 卒６平５ ) 卒６平５
11. 车六退五 卒３进１ 12. 相七退九 ) 将６进１ 9. 车六退四 二卒平４ 10. 车五平六 卒３平４ 11. 车六退五 卒４进１ 12. 车六退三
前卒平４ 13. 帅六进一 *`;
    const parser = new PGNParser(pgn);
    const root = parser.getRoot();
    expect(parser.getSkipped()).toHaveLength(0);

    // 主线 25 手，终着 帅六进一
    let tip = root;
    let count = 0;
    while (tip.children.length > 0) {
      tip = tip.children[0];
      count++;
    }
    expect(count).toBe(25);
    expect(tip.move?.zh).toBe("帅六进一");

    // 第 4 回合红方变着：车三平四（与主线 车四进七 同源）
    let node = root;
    for (let i = 0; i < 6; i++) node = node.children[0];
    expect(node.move?.zh).toBe("士５退６");
    expect(node.children).toHaveLength(2);
    expect(node.children[0].move?.zh).toBe("车四进七");
    expect(node.children[1].move?.zh).toBe("车三平四");

    // 第 8 回合红方变着：车五平四，内含 三卒平６（e1 吃 f1 车）
    node = root;
    for (let i = 0; i < 14; i++) node = node.children[0];
    expect(node.move?.zh).toBe("将５平６");
    expect(node.children).toHaveLength(2);
    expect(node.children[1].move?.zh).toBe("车五平四");

    const sanNode = node.children[1].children[0].children[0].children[0];
    expect(sanNode.move?.zh).toBe("三卒平６");
    expect(sanNode.move?.iccs).toBe("E1-F1");

    // 变着内第 10 回合嵌套变着：帅六进一（与 相五进七 同源）
    expect(sanNode.children[0].move?.zh).toBe("相五进七");
    expect(sanNode.children).toHaveLength(2);
    expect(sanNode.children[1].move?.zh).toBe("帅六进一");

    // 主线 9...二卒平４ 及其后的 卒３平４ / 前卒平４（多卒消歧）
    node = root;
    for (let i = 0; i < 18; i++) node = node.children[0];
    expect(node.move?.zh).toBe("二卒平４");
    for (const zh of [
      "车五平六",
      "卒３平４",
      "车六退五",
      "卒４进１",
      "车六退三",
      "前卒平４",
    ]) {
      node = node.children[0];
      expect(node.move?.zh).toBe(zh);
    }
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
