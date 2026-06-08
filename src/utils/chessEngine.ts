import {
  Chess,
  Move,
  validateFen as chessValidateFen,
  type Square,
  type PieceSymbol,
  type Color,
} from '@west-shell/xiangqi.js';

import { DEFAULT_FEN } from '../types';

export type { Move, Square, PieceSymbol, Color };

/**
 * Create a Chess instance from a FEN string.
 */
export function loadGame(fen: string = DEFAULT_FEN): Chess {
  return new Chess(fen);
}

/**
 * Make a move on a FEN position, returning the chess.js Move object.
 * Returns null if the move is illegal.
 */
export function makeMove(fen: string, san: string): Move | null {
  try {
    const chess = loadGame(fen);
    const move = chess.move(san);
    return move; // null if illegal, Move object if legal
  } catch {
    return null;
  }
}

/**
 * Get legal moves from a FEN position (verbose format).
 */
export function getLegalMoves(fen: string): Move[] {
  try {
    const chess = loadGame(fen);
    return chess.moves({ verbose: true }) as Move[];
  } catch {
    return [];
  }
}

/**
 * Check if the side to move is in check.
 */
export function isCheck(fen: string): boolean {
  try {
    const chess = loadGame(fen);
    return chess.isCheck();
  } catch {
    return false;
  }
}

/**
 * Check if the position is checkmate.
 */
export function isCheckmate(fen: string): boolean {
  try {
    const chess = loadGame(fen);
    return chess.isCheckmate();
  } catch {
    return false;
  }
}

/**
 * Check if the position is a draw.
 */
export function isDraw(fen: string): boolean {
  try {
    const chess = loadGame(fen);
    return chess.isDraw();
  } catch {
    return false;
  }
}

/**
 * Check if the game is over.
 */
export function isGameOver(fen: string): boolean {
  try {
    const chess = loadGame(fen);
    return chess.isGameOver();
  } catch {
    return false;
  }
}

/**
 * Validate FEN string and return detailed result.
 */
export function validateFen(fen: string): { ok: boolean; error?: string } {
  return chessValidateFen(fen);
}

/**
 * Get the turn color from a FEN string ('w' or 'b').
 */
export function getTurn(fen: string): Color {
  return (fen.split(' ')[1] as Color) || 'w';
}

/**
 * Extract PieceSymbol and Color from a piece character in FEN.
 * e.g. 'K' → { type: 'k', color: 'w' }, 'n' → { type: 'n', color: 'b' }
 */
export function parsePiece(pieceChar: string): { type: PieceSymbol; color: Color } | null {
  if (!pieceChar || !/[a-zA-Z]/.test(pieceChar)) return null;
  const lower = pieceChar.toLowerCase() as PieceSymbol;
  const color: Color = pieceChar === pieceChar.toUpperCase() ? 'w' : 'b';
  return { type: lower, color };
}
