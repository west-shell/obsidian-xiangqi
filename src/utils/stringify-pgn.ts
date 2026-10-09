import { getSaveNotation, getTurnFromFen } from "../chess";
import type { ChessNode, NodeEval } from "../types";
import { ANNOTATION_PREFIX } from "./icon";

/** FEN fullmove number (field 6); defaults to 1 when absent/invalid. */
export function getFullmoveFromFen(fen: string): number {
  const n = Number.parseInt(fen.split(" ")[5] ?? "", 10);
  return Number.isNaN(n) || n < 1 ? 1 : n;
}

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

/** `#a:` annotation key -> standard NAG; unmappable keys keep `#a:` form. */
const ANNOTATION_NAG: Record<string, string> = {
  "+": "$16",
  "-": "$17",
  "=": "$10",
  st: "$24",
};

const COLOR_BY_BRUSH: Record<string, string> = {
  g: "G",
  r: "R",
  y: "Y",
  b: "B",
};

function shapeColor(brush: string): string {
  return COLOR_BY_BRUSH[brush] ?? "B";
}

/** Format an eval the lichess way: `+0.35` / `-1.20` / `#3` / `#-4`. */
function formatLichessEval(ev: NodeEval): string {
  if (ev.scoreType === "mate") {
    return `#${ev.score >= 0 ? "" : "-"}${Math.abs(ev.score)}`;
  }
  const pawns = ev.score / 100;
  return `${pawns >= 0 ? "+" : "-"}${Math.abs(pawns).toFixed(2)}`;
}

/** Private %e: eval string (m+n / +n.nn), consumed by EVAL_REGEX on import. */
function formatPrivateEval(ev: NodeEval): string {
  const absScore = Math.abs(ev.score);
  return ev.scoreType === "mate"
    ? `m${ev.score >= 0 ? "+" : "-"}${absScore}`
    : `${ev.score >= 0 ? "+" : "-"}${(absScore / 100).toFixed(2)}`;
}

export interface NodeMetaOptions {
  includeComments?: boolean;
  includeEval?: boolean;
}

/**
 * Serialize a node's metadata (glyph suffix, annotation NAG, comments,
 * shapes, eval) in lichess-compatible form, to be appended right after the
 * move notation:
 *   e4!? $16 {comment} { [%csl Gb4][%cal Ge2e4] } { [%eval +0.35] }
 */
export function serializeNodeMeta(
  node: ChessNode,
  options: NodeMetaOptions = {},
): string {
  const includeComments = options.includeComments ?? true;
  const includeEval = options.includeEval ?? true;
  let meta = "";

  if (node.glyph) {
    meta += node.glyph.symbol;
  }

  if (node.annotation) {
    const nag = ANNOTATION_NAG[node.annotation];
    // Keys without a standard NAG (e.g. bm) keep the private #a: comment.
    meta += nag ? ` ${nag}` : ` {${ANNOTATION_PREFIX}${node.annotation}}`;
  }

  if (includeComments && node.comments?.length) {
    // Mirror lila PgnDump.authoredComment: each comment block carries its
    // own [%anno] inline; unauthored comments (or the exporter's own) stay bare.
    for (let i = 0; i < node.comments.length; i++) {
      const c = node.comments[i];
      const author = node.commentAuthors?.[i];
      meta += author
        ? ` {[%anno "${author.name}"${author.user ? `, ${author.user}` : ""}] ${c}}`
        : ` {${c}}`;
    }
  }

  if (includeComments && node.clock) {
    meta += ` {[%clk ${node.clock}]}`;
  }

  if (node.shapes?.length) {
    const highlights = node.shapes
      .filter((s) => !s.dest)
      .map((s) => shapeColor(s.brush) + s.orig);
    const arrows = node.shapes
      .filter((s) => s.dest)
      .map((s) => shapeColor(s.brush) + s.orig + s.dest);
    let block = "";
    if (highlights.length) block += `[%csl ${highlights.join(",")}]`;
    if (arrows.length) block += `[%cal ${arrows.join(",")}]`;
    if (block) meta += ` { ${block} }`;
  }

  if (includeEval && node.eval) {
    meta += ` { [%eval ${formatLichessEval(node.eval)}] }`;
    if (node.eval.bestmove) {
      // Keep the private %e: block only for lossless bestmove/ponder
      // round-trips; lichess strips it on import without showing it.
      let annotation = `%e:${formatPrivateEval(node.eval)}`;
      annotation += `,${node.eval.bestmove}`;
      if (node.eval.ponder) annotation += `,${node.eval.ponder}`;
      meta += ` {${annotation}}`;
    }
  }

  return meta;
}

export function stringifyPGN(root: ChessNode, includeEval = true): string {
  const nodeBrothers = genNodeBrothers(root);

  // Move numbering follows the root FEN: a fullmove-14 game resumes at
  // "14." (white to move) or "14..." (black to move) instead of restarting
  // at 1. For the default start position this resolves to step 0 → "1. e4".
  const fullmove = getFullmoveFromFen(root.fen);
  const rootStep =
    getTurnFromFen(root.fen) === "black" ? fullmove : fullmove - 1;

  // `lineStart` marks a black move that needs the "N..." prefix: one that
  // opens a line (first mainline move of a black-to-move game, first move
  // of a black variation) or one whose white half-move was separated from
  // it by comment blocks or a variation (lichess numbering). Black replies
  // directly following their white move stay bare.
  // `inVariation` suppresses the bare `*` filler inside parentheses —
  // lichess-style variations end at their last move.
  function walk(
    node: ChessNode,
    stepNum: number,
    lineStart = false,
    inVariation = false,
  ): string {
    let result = "";
    if (node.move) {
      const notation = getSaveNotation(node.move);
      if (node.color === "white") {
        result += `${stepNum}. ${notation}`;
      } else if (node.color === "black") {
        result += lineStart ? `${stepNum}... ${notation}` : notation;
      }
    }
    const meta = serializeNodeMeta(node, { includeEval });
    result += meta;
    const brothers = nodeBrothers.get(node);
    if (brothers?.length) {
      for (const brother of brothers) {
        // A black brother opens its own variation line → "N..." prefix.
        result += ` (${walk(brother, stepNum, brother.color === "black", true)})`;
      }
    }
    if (node.children[0]) {
      const next = node.children[0];
      const nextStepNum = next.color === "white" ? stepNum + 1 : stepNum;
      // Lichess (scalachess PgnStr) omits a black reply's number only when
      // it directly follows its white half-move. Comment blocks between the
      // two (eval/clock/comments — all brace-wrapped) or a variation in
      // between force the "N..." prefix, otherwise the move could be read
      // as a continuation of the variation. Glyph suffixes and `$n` NAGs
      // are part of the move token and never interrupt.
      const blackStarts =
        next.color === "black" &&
        (node === root || meta.includes("{") || Boolean(brothers?.length));
      result += ` ${walk(next, nextStepNum, blackStarts, inVariation)}`;
    } else if (node.result) {
      result += ` ${node.result}`;
    } else if (!inVariation) {
      result += " *";
    }
    return result;
  }
  return walk(root, rootStep).trim();
}
