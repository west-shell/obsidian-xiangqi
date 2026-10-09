import { describe, expect, test } from "vitest";
import type { ChessNode } from "../src/types";
import {
  applyAnnotationToggle,
  hasAnnotation,
  nagToAnnotationKey,
  pushAnnotation,
} from "../src/utils/annotation-glyphs";

const makeNode = (): ChessNode => ({
  id: "n1",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  move: null,
  color: null,
  children: [],
});

describe("nagToAnnotationKey", () => {
  test("maps study NAGs to their numeric key", () => {
    expect(nagToAnnotationKey("$16")).toBe("16");
    expect(nagToAnnotationKey("$36")).toBe("36");
    expect(nagToAnnotationKey("$140")).toBe("140");
  });

  test("legacy $24 imports as the custom st key", () => {
    expect(nagToAnnotationKey("$24")).toBe("st");
  });

  test("quality NAGs and unknown NAGs are rejected", () => {
    expect(nagToAnnotationKey("$1")).toBeNull();
    expect(nagToAnnotationKey("$6")).toBeNull();
    expect(nagToAnnotationKey("$99")).toBeNull();
  });
});

describe("applyAnnotationToggle", () => {
  test("quality keys swap the node.glyph slot exclusively", () => {
    const node = makeNode();
    applyAnnotationToggle(node, "1");
    expect(node.glyph?.symbol).toBe("!");
    applyAnnotationToggle(node, "4");
    expect(node.glyph?.symbol).toBe("??");
    expect(node.annotations).toBeUndefined();
    applyAnnotationToggle(node, "4");
    expect(node.glyph).toBeUndefined();
  });

  test("position keys are mutually exclusive", () => {
    const node = makeNode();
    applyAnnotationToggle(node, "16");
    applyAnnotationToggle(node, "18");
    expect(node.annotations).toEqual(["18"]);
    applyAnnotationToggle(node, "10");
    expect(node.annotations).toEqual(["10"]);
    applyAnnotationToggle(node, "10");
    expect(node.annotations).toBeUndefined();
  });

  test("position toggle preserves non-position keys", () => {
    const node = makeNode();
    applyAnnotationToggle(node, "36");
    applyAnnotationToggle(node, "16");
    applyAnnotationToggle(node, "18");
    expect(node.annotations).toEqual(["36", "18"]);
  });

  test("observation and custom keys stack freely and dedupe", () => {
    const node = makeNode();
    applyAnnotationToggle(node, "36");
    applyAnnotationToggle(node, "40");
    applyAnnotationToggle(node, "+");
    expect(node.annotations).toEqual(["36", "40", "+"]);
    applyAnnotationToggle(node, "40");
    expect(node.annotations).toEqual(["36", "+"]);
  });
});

describe("pushAnnotation / hasAnnotation", () => {
  test("push dedupes and hasAnnotation reflects state", () => {
    const node = makeNode();
    pushAnnotation(node, "16");
    pushAnnotation(node, "16");
    expect(node.annotations).toEqual(["16"]);
    expect(hasAnnotation(node, "16")).toBe(true);
    expect(hasAnnotation(node, "17")).toBe(false);
  });

  test("hasAnnotation resolves quality keys via node.glyph", () => {
    const node = makeNode();
    expect(hasAnnotation(node, "1")).toBe(false);
    applyAnnotationToggle(node, "1");
    expect(hasAnnotation(node, "1")).toBe(true);
    expect(hasAnnotation(node, "2")).toBe(false);
  });

  test("push ignores unknown keys", () => {
    const node = makeNode();
    pushAnnotation(node, "nope");
    expect(node.annotations).toBeUndefined();
  });
});
