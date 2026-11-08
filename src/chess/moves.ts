import { Chess } from "@weshell/xiangqi.js";
import type { Move, Square } from "@weshell/xiangqi.js";

// ========== Move Predicates & Helpers ==========
export function isMoveCheckmate(move: Move): boolean {
  return move.isCheckmate ?? false;
}

export function isMoveCheck(move: Move): boolean {
  return move.isCheck ?? move.isCheckmate ?? false;
}

// Result forced by the position itself — checkmate (将杀) or stalemate
// (困毙: the stranded side loses in xiangqi) — or null while the game
// continues. The move handler stores it on a mating move's node and the
// result toolbar treats a non-null value as read-only.
export function getAutoResult(fen: string): string | null {
  try {
    const game = new Chess(fen);
    if (game.isCheckmate() || game.isStalemate()) {
      return game.turn() === "w" ? "0-1" : "1-0";
    }
    return null;
  } catch {
    return null;
  }
}

export function getMoveDest(move: Move): Square | undefined {
  return move.to;
}

export function matchMove(existing: Move, incoming: Move): boolean {
  return existing.from === incoming.from && existing.to === incoming.to;
}

export function extraMoveDests(_move: Move): Square[] {
  // Xiangqi has no castling, so no extra drag targets.
  return [];
}

export function moveToUci(move: Move): string {
  return move.from + move.to;
}

export function isPromotionRank(_to: string, _color: "w" | "b"): boolean {
  return false;
}

export const PROMOTION_PIECES:
  | {
      type: "q" | "r" | "b" | "n";
      icon: string;
    }[]
  | null = null;
