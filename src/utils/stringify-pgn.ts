import { getSaveNotation } from "../chess";
import { ANNOTATION_PREFIX, SHAPES_PREFIX } from "./icon";
import type { ChessNode } from "../types";

function genNodeBrothers(root: ChessNode): Map<ChessNode, ChessNode[]> {
  const map = new Map<ChessNode, ChessNode[]>();
  function dfs(node: ChessNode) {
    if (node.children.length > 1) {
      const [main, ...siblings] = node.children;
      map.set(main, siblings);
    }
    for (const child of node.children) dfs(child);
  }
  dfs(root);
  return map;
}

export function stringifyPGN(root: ChessNode, includeEval = true): string {
  const nodeBrothers = genNodeBrothers(root);

  function walk(node: ChessNode, stepNum: number): string {
    let result = "";
    if (node.move) {
      const notation = getSaveNotation(node.move);
      if (node.color === "white") {
        result += `${stepNum}. ${notation}`;
      } else if (node.color === "black") {
        result += `${notation}`;
      }
    }
    if (node.comments?.length) {
      for (const c of node.comments) result += `{${c}}`;
    }
    if (node.annotation) {
      result += `{${ANNOTATION_PREFIX}${node.annotation}}`;
    }
    if (node.shapes?.length) {
      const shapeStr = node.shapes
        .map((s) => s.orig + (s.dest ?? "") + ":" + s.brush)
        .join(",");
      result += `{${SHAPES_PREFIX}${shapeStr}}`;
    }
    if (includeEval && node.eval) {
      const absScore = Math.abs(node.eval.score);
      const evalStr =
        node.eval.scoreType === "mate"
          ? `m${node.eval.score >= 0 ? "+" : "-"}${absScore}`
          : `${node.eval.score >= 0 ? "+" : "-"}${(absScore / 100).toFixed(2)}`;
      let annotation = `%e:${evalStr}`;
      if (node.eval.bestmove) {
        annotation += `,${node.eval.bestmove}`;
        if (node.eval.ponder) annotation += `,${node.eval.ponder}`;
      }
      if (node.glyph) {
        annotation += `,${node.glyph.symbol}`;
      }
      result += `{${annotation}}`;
    }
    const brothers = nodeBrothers.get(node);
    if (brothers?.length) {
      for (const brother of brothers) {
        if (brother.color === "white") {
          result += ` (${walk(brother, stepNum)})`;
        } else if (brother.color === "black") {
          result += ` (${stepNum}. ... ${walk(brother, stepNum)})`;
        }
      }
    }
    if (node.children[0]) {
      const next = node.children[0];
      const nextStepNum = next.color === "white" ? stepNum + 1 : stepNum;
      result += ` ${walk(next, nextStepNum)}`;
    } else if (node.result) {
      result += ` ${node.result}`;
    } else {
      result += " *";
    }
    return result;
  }
  return walk(root, 0);
}
