import type { ChessNode, NodeEval, PvLine } from "../../types";
import { moveToUci } from "../../chess";

/**
 * Derive the eval of the position one ply down a parent's PV line.
 *
 * Node evals are stored in white view, and a PV line's white-view score
 * is constant along the line, so the child inherits the line's score
 * directly; the line itself shifts by one move, making the next PV move
 * the child's bestmove and the one after it the ponder move. The depth
 * is the parent search's depth: it is the same search that produced the
 * line, so no re-analysis is needed.
 */
export function evalFromPvLine(pv: PvLine, depth: number): NodeEval {
  const rest = pv.moves.slice(1);
  return {
    score: pv.score,
    scoreType: pv.scoreType,
    depth,
    // Flag the eval as attributed (line horizon shrinks per move), so a
    // consumer needing a full-depth search of this exact position can
    // tell it apart from one actually searched here.
    derived: true,
    bestmove: rest.length > 0 ? rest[0] : undefined,
    ponder: rest.length > 1 ? rest[1] : undefined,
    pvs:
      rest.length > 0
        ? [{ score: pv.score, scoreType: pv.scoreType, moves: rest }]
        : undefined,
  };
}

/**
 * Find the parent search's PV line that starts with `uci`: the position
 * after that move was evaluated by the same search and needs no
 * re-analysis.
 */
export function matchPvLine(
  parentEval: NodeEval | undefined,
  uci: string,
): PvLine | undefined {
  if (!parentEval?.pvs || !uci) return undefined;
  return parentEval.pvs.find((p) => p.moves[0] === uci);
}

/**
 * Derive the child eval for the move `uci` from the parent's search, or
 * undefined when the parent's search did not cover that move.
 */
export function deriveChildEval(
  parentEval: NodeEval | undefined,
  uci: string,
): NodeEval | undefined {
  if (!parentEval) return undefined;
  const pv = matchPvLine(parentEval, uci);
  return pv ? evalFromPvLine(pv, parentEval.depth) : undefined;
}

/**
 * Attribute a finished search to the parent node's existing children:
 * every child whose move starts one of the parent's PV lines gets its
 * eval derived from that line (same search, exact). A child eval that
 * is already at least as deep is never overwritten. Returns true when
 * at least one child eval was written.
 */
export function fillChildrenFromEval(parent: ChessNode): boolean {
  const ev = parent.eval;
  if (!ev?.pvs) return false;
  let changed = false;
  for (const child of parent.children) {
    if (!child.move) continue;
    if (child.eval && child.eval.depth >= ev.depth) continue;
    const derived = deriveChildEval(ev, moveToUci(child.move));
    if (derived) {
      child.eval = derived;
      changed = true;
    }
  }
  return changed;
}
