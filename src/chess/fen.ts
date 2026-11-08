// ========== FEN Helpers ==========

// Minimal edit-FEN shell for the FEN editor: xiangqi FENs carry no
// castling/en-passant/move-counter fields.
export function buildDefaultEditFen(boardPart: string): string {
  return `${boardPart} w`;
}

export function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}
