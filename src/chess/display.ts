import type { Move } from "@weshell/xiangqi.js";
import { CLS_PREFIX, PIECE_CHARS } from "./constants";
import { getMoveNotation } from "./notation";

// ========== Node Display Functions ==========
export type NodeDisplay =
  { type: "icon"; value: string } | { type: "char"; value: string } | null;

export function getNodeLabel(
  move: Move | null,
  mode: number,
  notationType?: string,
): string {
  if (!move) return "= 开局 =";
  if (mode === 1) return getMoveNotation(move, notationType);
  return "";
}

export function getNodeDisplay(move: Move): NodeDisplay {
  const raw = move.piece;
  const char = move.color === "w" ? raw.toUpperCase() : raw;
  const label = PIECE_CHARS ? PIECE_CHARS[char] : null;
  return label ? { type: "char", value: label } : null;
}

export function getNodeWidth(
  move: Move | null,
  mode: number,
  _measureFn?: (text: string, fontSize: string) => number,
  notationType?: string,
): number {
  if (mode === 0) return 13;
  const notation = move ? getMoveNotation(move, notationType) : "= 开局 =";
  if (_measureFn) {
    return Math.max(13, Math.ceil(_measureFn(notation, "6px")) + 4);
  }
  return Math.max(13, notation.length * 5.5);
}

export function getNodeFill(side: string | null): string {
  if (side === "white") return "var(--xq-piece-red, var(--color-red))";
  if (side === "black") return "var(--xq-piece-black, var(--color-blue))";
  return "green";
}

export function getNodeTextColor(side: string | null): string {
  return "white";
}

export function getMoveListSideClass(side: string | null): string {
  if (side === "white" || side === "red") {
    return `${CLS_PREFIX}-moves__move--white`;
  }
  return `${CLS_PREFIX}-moves__move--black`;
}

export function getStartLabel(): string {
  return "==开局==";
}
