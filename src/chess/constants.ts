// ========== Constants ==========
export const DEFAULT_FEN =
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";
export const EMPTY_FEN = "4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1";
export const CLS_PREFIX = "xq";
export const WRAP_CLASS = "xq-wrap";
export const BOARD_ELEMENT = "xq-board";
export const BOARD_ASPECT_RATIO = 0.9;
export const LAYOUT_CHANGE_EVENT = "chess-layout-change";
export const ZOOM_CHANGE_EVENT = "chess-zoom-changed";
export const RESIZE_EVENT = "xiangqiground.resize";
export const DEFAULT_TREE_BLOCK_NAMES = ["xiangqi", "xq"];
export const DEFAULT_FEN_BLOCK_NAMES = ["fen"];
export const RIBBON_ICON = "xiangqi-icon";
export const DEFAULT_FILENAME = "Untitled";
export const PGN_PLACEHOLDER = "H2-E2 H8-E8 ...";
export const PIECE_CHARS: Record<string, string> | null = {
  K: "帅",
  A: "仕",
  B: "相",
  N: "马",
  R: "车",
  C: "炮",
  P: "兵",
  k: "将",
  a: "士",
  b: "象",
  n: "马",
  r: "车",
  c: "炮",
  p: "卒",
};
export const GRID_SVG: string | null =
  `<svg class="xq-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 500" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none"><g fill="none" stroke="var(--xq-grid-color,#555)" stroke-width="1"><rect x="20" y="20" width="410" height="460" stroke-width="3"/><rect x="25" y="25" width="400" height="450"/><path d="M25 25H425M25 75H425M25 125H425M25 175H425M25 225H425M25 275H425M25 325H425M25 375H425M25 425H425M25 475H425"/><path d="M25 25V225M75 25V225M125 25V225M175 25V225M225 25V225M275 25V225M325 25V225M375 25V225M425 25V225"/><path d="M25 275V475M75 275V475M125 275V475M175 275V475M225 275V475M275 275V475M325 275V475M375 275V475M425 275V475"/><path d="M175 25L275 125M275 25L175 125M175 375L275 475M275 375L175 475"/><path d="M71 113.5v7.5h-7.5M79 113.5v7.5h7.5M79 136.5v-7.5h7.5M71 136.5v-7.5h-7.5M371 113.5v7.5h-7.5M379 113.5v7.5h7.5M379 136.5v-7.5h7.5M371 136.5v-7.5h-7.5M71 363.5v7.5h-7.5M79 363.5v7.5h7.5M79 386.5v-7.5h7.5M71 386.5v-7.5h-7.5M371 363.5v7.5h-7.5M379 363.5v7.5h7.5M379 386.5v-7.5h7.5M371 386.5v-7.5h-7.5M121 163.5v7.5h-7.5M129 163.5v7.5h7.5M129 186.5v-7.5h7.5M121 186.5v-7.5h-7.5M221 163.5v7.5h-7.5M229 163.5v7.5h7.5M229 186.5v-7.5h7.5M221 186.5v-7.5h-7.5M321 163.5v7.5h-7.5M329 163.5v7.5h7.5M329 186.5v-7.5h7.5M321 186.5v-7.5h-7.5M121 313.5v7.5h-7.5M129 313.5v7.5h7.5M129 336.5v-7.5h7.5M121 336.5v-7.5h-7.5M221 313.5v7.5h-7.5M229 313.5v7.5h7.5M229 336.5v-7.5h7.5M221 336.5v-7.5h-7.5M321 313.5v7.5h-7.5M329 313.5v7.5h7.5M329 336.5v-7.5h7.5M321 336.5v-7.5h-7.5M29 163.5v7.5h7.5M29 186.5v-7.5h7.5M29 313.5v7.5h7.5M29 336.5v-7.5h7.5M421 163.5v7.5h7.5M421 186.5v-7.5h7.5M421 313.5v7.5h7.5M421 336.5v-7.5h7.5"/></g><g fill="var(--xq-grid-color,#555)" font-size="30" text-anchor="middle" font-family="serif"><text x="100" y="250" dominant-baseline="middle" dy="0.1em">楚 河</text><text x="350" y="250" dominant-baseline="middle" dy="0.1em">漢 界</text></g></svg>`;
export const NODE_CHAR_DY = 0;
export const DEFAULT_LANG = "zh";

// ========== Flags ==========
export const HAS_PROMOTION = false;
export const PRIMARY_PLAYER_KEY = "Red";
/** Piece-color key of the first player, for player-bar side marks. */
export const FIRST_PLAYER_COLOR = "red";
/** Piece-color key of the second player, for player-bar side marks. */
export const SECOND_PLAYER_COLOR = "black";
/** i18n key of the first player's side name (chess: White, xiangqi: Red). */
export const FIRST_SIDE_KEY = "side.red";
/** i18n key of the second player's side name (Black in both variants). */
export const SECOND_SIDE_KEY = "side.black";
