// ========== Chess960 stubs (chess-only feature; shared files guard on null) ==========

// Xiangqi has no Chess960; returning null disables the adapter callers.
export function randomChess960Fen(): string | null {
  return null;
}

// Xiangqi has no PGN [Variant] tag; returning null keeps headers untouched.
export function getPgnVariantTag(_fen: string): string | null {
  return null;
}

// Xiangqi has no numbered start positions; returning null disables
// the by-number picker (chess-only UI, not synced into this repo).
export function chess960FenByNumber(_spn: number): string | null {
  return null;
}

export function chess960SpnFromFen(_fen: string): number | null {
  return null;
}
