import { Chess, type Move, moveToUci } from "../../chess";
import type { ChessNode, GhostLine, GhostLines } from "../../types";

/** Ghost ids share this prefix so generic node consumers can guard. */
export const GHOST_ID_PREFIX = "ghost:";

/** Max ghost plies rendered per line. */
export const GHOST_MAX_PLIES = 10;

export function isGhostNode(node: ChessNode): boolean {
  return node.id.startsWith(GHOST_ID_PREFIX);
}

function ghostFromMove(move: Move, id: string, parentID: string): ChessNode {
  return {
    id,
    fen: move.after,
    move,
    color: move.color === "w" ? "white" : "black",
    parentID,
    children: [],
    comments: [],
  };
}

/**
 * Merge each MultiPV line of `node.eval.pvs` against the existing tree:
 * the line is walked ply by ply while a real child matches the PV move
 * (UCI compare); the remaining moves become a ghost chain of plain
 * ChessNode objects (ghost ids, never registered in the nodeMap) hanging
 * from the last matched node. Lines that fully match the tree keep only
 * their matchedIds (real-node highlight), with a null head.
 *
 * `maxLines` caps how many PV lines (by rank) are rendered; the rest are
 * skipped entirely.
 *
 * Pure with respect to the tree: `node` and its descendants are read,
 * never written.
 */
export function buildGhostLines(
  node: ChessNode,
  maxPlies: number = GHOST_MAX_PLIES,
  maxLines: number = Number.POSITIVE_INFINITY,
): GhostLines | null {
  const pvs = node.eval?.pvs;
  if (!pvs || pvs.length === 0) return null;
  const lineCount = Math.min(pvs.length, maxLines);
  const chess = new Chess();
  const lines: GhostLine[] = [];
  for (let rank = 0; rank < lineCount; rank++) {
    const pv = pvs[rank];
    const moves = pv.moves.slice(0, maxPlies);
    if (moves.length === 0) continue;

    // Walk the existing tree while the PV follows played moves.
    const matchedIds: string[] = [];
    let cur = node;
    let i = 0;
    while (i < moves.length) {
      const child = cur.children.find(
        (c) => c.move && moveToUci(c.move) === moves[i],
      );
      if (!child) break;
      matchedIds.push(child.id);
      cur = child;
      i++;
    }

    // Build the ghost chain for the remaining moves.
    let head: ChessNode | null = null;
    let tail: ChessNode | null = null;
    if (i < moves.length) {
      let replayOk = true;
      try {
        chess.load(cur.fen);
      } catch {
        replayOk = false;
      }
      for (let j = i; replayOk && j < moves.length; j++) {
        const uci = moves[j];
        // Variant-agnostic replay args (no promotion object-literal key:
        // xiangqi's move() type rejects unknown literal properties).
        const args: { from: string; to: string; promotion?: string } = {
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
        };
        if (uci.length > 4) {
          args.promotion = uci.slice(4, 5);
        }
        let move: Move;
        try {
          move = chess.move(args);
        } catch {
          break;
        }
        const ghost = ghostFromMove(
          move,
          `${GHOST_ID_PREFIX}${rank}:${j}`,
          tail ? tail.id : cur.id,
        );
        if (tail) tail.children.push(ghost);
        else head = ghost;
        tail = ghost;
      }
    }

    if (matchedIds.length === 0 && !head) continue;
    lines.push({
      rank,
      score: pv.score,
      scoreType: pv.scoreType,
      matchedIds,
      attachId: cur.id,
      head,
    });
  }
  if (lines.length === 0) return null;
  return { nodeId: node.id, lines };
}
