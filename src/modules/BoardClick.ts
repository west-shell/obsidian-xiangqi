import { Chess, HAS_PROMOTION, isPromotionRank, type Square } from "../chess";
import { registerBlockModule, registerFileModule } from "../core/module-system";
import type { IHost } from "../types";

type TryMovePayload = { from: Square; to: Square };

function tryMove(chess: Chess, host: IHost, from: Square, to: Square): void {
  const eventBus = host.eventBus;
  try {
    chess.load(host.fen);
    const piece = chess.get(from);
    const color = piece?.color;
    if (
      HAS_PROMOTION &&
      piece?.type === "p" &&
      color &&
      isPromotionRank(to, color)
    ) {
      const moves = chess.moves({ square: from, verbose: true });
      const promoMoves = moves.filter((m) => m.to === to && "promotion" in m);
      if (promoMoves.length > 0) {
        host.markedPos = null;
        eventBus.emit("promote", { from, to, color });
        return;
      }
    }
    const move = chess.move({ from, to });
    if (move) {
      host.markedPos = null;
      eventBus.emit("runmove", move);
    } else {
      host.markedPos = to;
      eventBus.emit("updateUI");
    }
  } catch {
    host.markedPos = null;
    eventBus.emit("updateUI");
  }
}

function handleEditClick(host: IHost, clickedKey: Square): void {
  const eventBus = host.eventBus;
  const chess = new Chess(host.fen, { skipValidation: true });

  if (!host.markedPos && !host.selectedPiece) {
    const piece = chess.get(clickedKey);
    if (piece) {
      host.markedPos = clickedKey;
      eventBus.emit("updateUI");
    }
  } else if (host.markedPos && !host.selectedPiece) {
    const from = host.markedPos;
    const piece = chess.get(from);
    if (piece) {
      chess.remove(clickedKey);
      const sqPiece = chess.get(from);
      chess.remove(from);
      if (sqPiece) chess.put(sqPiece, clickedKey);
      host.fen = chess.fen();
      host.markedPos = null;
      eventBus.emit("updateUI");
    } else {
      host.markedPos = null;
      eventBus.emit("updateUI");
    }
  } else if (host.selectedPiece) {
    chess.remove(clickedKey);
    chess.put(host.selectedPiece, clickedKey);
    host.fen = chess.fen();
    host.selectedPiece = null;
    host.markedPos = null;
    eventBus.emit("updateUI");
  }
}

const BoardClickModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;
    const chess = new Chess();

    eventBus.on<Square>("click", (clickedKey) => {
      if (!clickedKey) return;
      if ("editing" in host && host.editing) {
        handleEditClick(host, clickedKey);
        return;
      }
      if (!host.markedPos) {
        host.markedPos = clickedKey;
        eventBus.emit("updateUI");
        return;
      }
      tryMove(chess, host, host.markedPos, clickedKey);
    });

    eventBus.on<TryMovePayload>("trymove", (payload) => {
      if (!payload) return;
      tryMove(chess, host, payload.from, payload.to);
    });
  },
};

registerFileModule("BoardClick", BoardClickModule);
registerBlockModule("BoardClick", BoardClickModule);
