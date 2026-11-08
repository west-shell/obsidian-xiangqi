// Library re-exports: every consumer imports these through the
// "../chess" barrel so the variant adapter stays swappable.
export { Chessground } from "@weshell/xiangqiground";
export type { Api } from "@weshell/xiangqiground/api";
export type { Config } from "@weshell/xiangqiground/config";
export type { DrawShape } from "@weshell/xiangqiground/draw";
export type * as cg from "@weshell/xiangqiground/types";
export {
  Chess,
  validateFen,
  type Piece,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "@weshell/xiangqi.js";
