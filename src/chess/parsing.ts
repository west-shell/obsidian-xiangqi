import type { Chess as ChessClass, Move } from "@weshell/xiangqi.js";

// ========== Token/Parser Functions ==========
// ICCS coordinates (h2e2 / H2-E2) plus Chinese move notation (炮二平五).
// The three Chinese branches mirror xiangqi.js zhToWxf Pattern B/A/C:
// B: 炮二平五 / 马8进7 — piece + file + action + target
// A: 前车平五 — 前/后/中 disambiguation prefix + piece + action + target
// C: 一兵平1 — multi-pawn ordinal + pawn + action + target
// File/target digits accept 汉字 / full-width / ASCII forms; the piece set
// matches xiangqi.js zhToWxf's PIECE_MAP keys exactly so every token the
// regex admits is convertible by the engine.
const ZH_PIECE_CLASS = "[帅将仕士相象马馬傌车車俥炮砲兵卒]";
const ZH_NUM_CLASS = "[一二三四五六七八九１-９1-9]";
const ZH_ACT_CLASS = "[进退平]";
export const MOVE_REGEX = new RegExp(
  `^(?:[A-Ia-i][0-9]-?[A-Ia-i][0-9]` +
    `|${ZH_PIECE_CLASS}${ZH_NUM_CLASS}${ZH_ACT_CLASS}${ZH_NUM_CLASS}` +
    `|[前后中]${ZH_PIECE_CLASS}${ZH_ACT_CLASS}${ZH_NUM_CLASS}` +
    `|[一二三四五][兵卒]${ZH_ACT_CLASS}${ZH_NUM_CLASS}` +
    `)`,
);

export const FEN_REGEX =
  /^[rnbakcpRNBAKCP1-9]+(\/[rnbakcpRNBAKCP1-9]+){8,9}(\s+[wr])?/;

export type MoveTokenType = "iccs-move" | "wxf-move";

export function getMoveTokenType(value: string): MoveTokenType {
  // Tokens reaching here already matched MOVE_REGEX: an [A-Ia-i] lead means
  // ICCS coordinates, anything else is Chinese (wxf) notation.
  if (/^[A-Ia-i]/.test(value)) {
    return "iccs-move";
  }
  return "wxf-move";
}

export const PRIMARY_MOVE_TOKEN_TYPES: ReadonlyArray<MoveTokenType> = [
  "iccs-move",
  "wxf-move",
];

export function parseMoveInGame(
  chess: InstanceType<typeof ChessClass>,
  token: string,
  _tokenType: MoveTokenType,
): Move | null {
  return chess.move(token) ?? null;
}

export const SHAPE_SQUARE_REGEX = /[a-i][0-9]/;
/** Square coordinate pattern (variant adapter); embed into other regexes. */
export const SQUARE_PATTERN = "[a-i][0-9]";
export const SHAPE_PART_REGEX = /^([a-i][0-9])([a-i][0-9])?:([gryb])$/;
export const EVAL_REGEX =
  /^%e:([m+-]?\d+(?:\.\d+)?|[m+-]?[+-]\d+(?:\.\d+)?),?([a-i0-9]+)?,?([a-i0-9]+)?,?(!\?|\?!|\?\?|[?!]|!!)?$/;
/** Lichess study annotator profile URL prefix; null = no per-user pages. */
export const ANNOTATOR_URL_PREFIX: string | null = null;
