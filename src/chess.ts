// Re-export from @west-shell/xiangqiground
export { Chessground } from "@west-shell/xiangqiground";
export type { Api } from "@west-shell/xiangqiground/api";
export type { Config } from "@west-shell/xiangqiground/config";
export type { DrawShape } from "@west-shell/xiangqiground/draw";
export type * as cg from "@west-shell/xiangqiground/types";

// Re-export from @west-shell/xiangqi.js
export {
  Chess,
  validateFen,
  type Piece,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "@west-shell/xiangqi.js";
