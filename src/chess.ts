// ========== Library Re-exports ==========
export { Chessground } from "@west-shell/xiangqiground";
export type { Api } from "@west-shell/xiangqiground/api";
export type { Config } from "@west-shell/xiangqiground/config";
export type { DrawShape } from "@west-shell/xiangqiground/draw";
export type * as cg from "@west-shell/xiangqiground/types";
export {
  Chess,
  validateFen,
  type Piece,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "@west-shell/xiangqi.js";

import type {
  Chess as ChessClass,
  Move,
  Piece,
  Square,
} from "@west-shell/xiangqi.js";

// ========== Constants ==========
export const DEFAULT_FEN =
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";
export const EMPTY_FEN = "4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1";
export const LAYOUT_CLASS = "chess-layout";
export const LAYOUT_CLASS_GENFEN = "chess-layout--genfen";
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
  `<svg class="xq-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 500" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none"><rect x="20" y="20" width="410" height="460" fill="none" stroke="var(--chess-grid-color,#555)" stroke-width="3"/><rect x="25" y="25" width="400" height="450" fill="none" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="25" x2="425" y2="25" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="75" x2="425" y2="75" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="125" x2="425" y2="125" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="175" x2="425" y2="175" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="225" x2="425" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="275" x2="425" y2="275" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="325" x2="425" y2="325" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="375" x2="425" y2="375" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="425" x2="425" y2="425" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="475" x2="425" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="25" x2="25" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="75" y1="25" x2="75" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="125" y1="25" x2="125" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="175" y1="25" x2="175" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="225" y1="25" x2="225" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="275" y1="25" x2="275" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="325" y1="25" x2="325" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="375" y1="25" x2="375" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="425" y1="25" x2="425" y2="225" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="25" y1="275" x2="25" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="75" y1="275" x2="75" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="125" y1="275" x2="125" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="175" y1="275" x2="175" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="225" y1="275" x2="225" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="275" y1="275" x2="275" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="325" y1="275" x2="325" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="375" y1="275" x2="375" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="425" y1="275" x2="425" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="175" y1="25" x2="275" y2="125" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="275" y1="25" x2="175" y2="125" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="175" y1="375" x2="275" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><line x1="275" y1="375" x2="175" y2="475" stroke="var(--chess-grid-color,#555)" stroke-width="1"/><text x="100" y="250" font-size="30" fill="var(--chess-grid-color,#555)" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">楚 河</text><text x="350" y="250" font-size="30" fill="var(--chess-grid-color,#555)" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">漢 界</text><path d="M 71,113.5 v 7.5 h -7.5 M 79,113.5 v 7.5 h 7.5 M 79,136.5 v -7.5 h 7.5 M 71,136.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 371,113.5 v 7.5 h -7.5 M 379,113.5 v 7.5 h 7.5 M 379,136.5 v -7.5 h 7.5 M 371,136.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 71,363.5 v 7.5 h -7.5 M 79,363.5 v 7.5 h 7.5 M 79,386.5 v -7.5 h 7.5 M 71,386.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 371,363.5 v 7.5 h -7.5 M 379,363.5 v 7.5 h 7.5 M 379,386.5 v -7.5 h 7.5 M 371,386.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 121,163.5 v 7.5 h -7.5 M 129,163.5 v 7.5 h 7.5 M 129,186.5 v -7.5 h 7.5 M 121,186.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 221,163.5 v 7.5 h -7.5 M 229,163.5 v 7.5 h 7.5 M 229,186.5 v -7.5 h 7.5 M 221,186.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 321,163.5 v 7.5 h -7.5 M 329,163.5 v 7.5 h 7.5 M 329,186.5 v -7.5 h 7.5 M 321,186.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 121,313.5 v 7.5 h -7.5 M 129,313.5 v 7.5 h 7.5 M 129,336.5 v -7.5 h 7.5 M 121,336.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 221,313.5 v 7.5 h -7.5 M 229,313.5 v 7.5 h 7.5 M 229,336.5 v -7.5 h 7.5 M 221,336.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 321,313.5 v 7.5 h -7.5 M 329,313.5 v 7.5 h 7.5 M 329,336.5 v -7.5 h 7.5 M 321,336.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 29,163.5 v 7.5 h 7.5 M 29,186.5 v -7.5 h 7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 29,313.5 v 7.5 h 7.5 M 29,336.5 v -7.5 h 7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 421,163.5 v 7.5 h -7.5 M 421,186.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/><path d="M 421,313.5 v 7.5 h -7.5 M 421,336.5 v -7.5 h -7.5" stroke="var(--chess-grid-color,#555)" stroke-width="1" fill="none"/></svg>`;
export const TREE_LAYOUT_SPACING = 0.4;
export const TREE_SPACING_X = 22;
export const NODE_CHAR_DY = 0;
export const DEFAULT_LANG = "zh";

// ========== Flags ==========
export const HAS_PROMOTION = false;
export const PRIMARY_PLAYER_KEY = "Red";

// ========== Move Functions ==========
export function getMoveNotation(move: Move): string {
  return move.zh ?? move.iccs ?? "";
}

export function getSaveNotation(move: Move): string {
  return move.iccs ?? move.zh ?? "";
}

export function isMoveCheckmate(move: Move): boolean {
  return move.isCheckmate ?? false;
}

export function isMoveCheck(move: Move): boolean {
  return move.isCheck ?? move.isCheckmate ?? false;
}

export function getMoveDest(move: Move): Square | undefined {
  return move.to;
}

export function matchMove(existing: Move, incoming: Move): boolean {
  return existing.from === incoming.from && existing.to === incoming.to;
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

// ========== Node Display Functions ==========
export type NodeDisplay =
  { type: "icon"; value: string } | { type: "char"; value: string } | null;

export function getNodeLabel(move: Move | null, mode: number): string {
  if (!move) return "= 开局 =";
  if (mode === 1) return move.zh ?? move.iccs ?? "";
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
): number {
  if (mode === 0) return 13;
  const notation = move ? (move.zh ?? move.iccs ?? "") : "= 开局 =";
  if (_measureFn) {
    return Math.max(13, Math.ceil(_measureFn(notation, "6px")) + 4);
  }
  return Math.max(13, notation.length * 5.5);
}

export function getNodeFill(side: string | null): string {
  if (side === "white") return "var(--chess-piece-red, var(--color-red))";
  if (side === "black") return "var(--chess-piece-black, var(--color-blue))";
  return "green";
}

export function getNodeTextColor(side: string | null): string {
  return "white";
}

export function getMoveListSideClass(side: string | null): string {
  if (side === "white" || side === "red") return "red";
  return "black";
}

export function getStartLabel(): string {
  return "= 开局 =";
}

// ========== FEN Build Functions ==========
export function buildDefaultEditFen(boardPart: string): string {
  return `${boardPart} w`;
}

// ========== Token/Parser Functions ==========
export const MOVE_REGEX = /^[A-Ia-i][0-9]-?[A-Ia-i][0-9]/;

export const FEN_REGEX =
  /^[rnbakcpRNBAKCP1-9]+(\/[rnbakcpRNBAKCP1-9]+){8,9}(\s+[wr])?/;

export type MoveTokenType = "iccs-move" | "wxf-move";

export function getMoveTokenType(value: string): MoveTokenType {
  if (
    /^[兵卒车马炮相士帅将车][一二三四五六七八九123456789进退平前后左右]/.test(
      value,
    )
  ) {
    return "wxf-move";
  }
  return "iccs-move";
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
export const SHAPE_PART_REGEX = /^([a-i][0-9])([a-i][0-9])?:([gryb])$/;
export const EVAL_REGEX =
  /^%e:([m+-]?\d+(?:\.\d+)?|[m+-]?[+-]\d+(?:\.\d+)?),?([a-i0-9]+)?,?([a-i0-9]+)?,?(!\?|\?!|\?\?|[?!]|!!)?$/;

export function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

// ========== Theme CSS Vars ==========
export interface ThemeData {
  name: string;
  nameZh: string;
  bg: string;
  texture?: string;
  grid?: "dark" | "light" | "none";
  bgImage?: { path: string; base64: string };
}

export function applyThemeCSSVars(
  settings: {
    zoom: number;
    fontSize: number;
    boardMarginTop: number;
    boardMarginBottom: number;
    showCoordinateLabels: boolean;
  },
  themeData: ThemeData,
  app?: {
    vault: {
      adapter: { getResourcePath: (p: string) => string };
      configDir: string;
    };
  },
): void {
  const boardScale = (settings.zoom / 100) * 0.75 + 0.25;
  const body = activeDocument.body.style;
  body.setProperty("--chess-board-scale", `${boardScale}`);
  body.setProperty("--chess-font-size", `${settings.fontSize}px`);

  let bg = themeData.bg;
  if (app && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(bg)) {
    bg = `url('${app.vault.adapter.getResourcePath(app.vault.configDir + "/" + bg)}') center / cover no-repeat`;
    body.setProperty("--chess-board-bg-color", "#333");
  } else {
    body.setProperty("--chess-board-bg-color", bg);
    body.removeProperty("--chess-board-bg-image");
  }
  if (bg.startsWith("url(")) {
    body.setProperty("--chess-board-bg-image", bg);
  }

  if (themeData.texture) {
    body.setProperty("--chess-board-texture", themeData.texture);
  } else {
    body.removeProperty("--chess-board-texture");
  }
  if (themeData.grid) {
    body.setProperty(
      "--chess-grid-color",
      themeData.grid === "dark"
        ? "#555"
        : themeData.grid === "light"
          ? "#ccc"
          : "transparent",
    );
  } else {
    body.removeProperty("--chess-grid-color");
  }
  body.setProperty("--chess-board-margin-top", `${settings.boardMarginTop}px`);
  body.setProperty(
    "--chess-board-margin-bottom",
    `${settings.boardMarginBottom}px`,
  );
  body.setProperty(
    "--chess-coords-display",
    settings.showCoordinateLabels ? "flex" : "none",
  );
}

// ========== Other ==========
export function parseExternalUrl(source: string): string | null {
  const data = parsePikafishUrl(source);
  if (!data) return null;
  const { initFEN, PGN } = data;
  const lines = [`[FEN "${initFEN}"]`];
  const moves = PGN.map((m) => m.iccs ?? "").filter(Boolean);
  for (let i = 0; i < moves.length; i += 2) {
    lines.push(
      `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ""}`.trim(),
    );
  }
  return lines.join("\n");
}

export function createPieceFromChar(char: string): Piece | null {
  if (!PIECE_CHARS) return null;
  const map = PIECE_CHARS;
  for (const [key, val] of Object.entries(map)) {
    if (val === char) {
      const isUpper = key === key.toUpperCase();
      return {
        type: key.toLowerCase() as Piece["type"],
        color: isUpper ? "w" : "b",
      };
    }
  }
  return null;
}

export function registerCustomIcon(
  addIconFn: (id: string, svg: string) => void,
): void {
  addIconFn(
    "xiangqi-icon",
    `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="var(--background-primary-alt)" stroke="var(--text-normal)" stroke-width="4"/><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-size="60" fill="var(--text-normal)" font-weight="bold">象</text></svg>`,
  );
}

function parsePikafishUrl(source: string): {
  initFEN: string;
  PGN: Move[];
} | null {
  const urlMatch = source.match(/xiangqiai\.com\/#\/(.+)/);
  if (!urlMatch) return null;
  try {
    const decoded = decodeURIComponent(urlMatch[1]);
    const parts = decoded.split(" moves ");
    const initFEN = parts[0] || DEFAULT_FEN;
    const moves: Move[] = [];
    if (parts[1]) {
      const moveStrs = parts[1].trim().split(/\s+/);
      for (const m of moveStrs) {
        const iccs =
          m.length === 4
            ? `${m[0].toUpperCase()}${m[1]}-${m[2].toUpperCase()}${m[3]}`
            : m;
        moves.push({ iccs } as Move);
      }
    }
    return { initFEN, PGN: moves };
  } catch {
    return null;
  }
}
