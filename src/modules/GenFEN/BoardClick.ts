import { Chess, type Square } from "../../chess";
import { registerGenFENModule } from "../../core/module-system";
import type { IGenFENHost } from "../../types";

const BoardClickModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on<Square>("click", (clickedKey) => {
      if (!clickedKey) return;
      const chess = new Chess(host.fen, { skipValidation: true });

      if (!host.markedPos && !host.selectedPiece) {
        const piece = chess.get(clickedKey);
        if (piece) {
          host.markedPos = clickedKey;
          eventBus.emit("updateUI");
        }
      } else if (host.markedPos && !host.selectedPiece) {
        const from = host.markedPos;
        const to = clickedKey;
        const piece = chess.get(from);
        if (piece) {
          chess.remove(to);
          const sqPiece = chess.get(from);
          chess.remove(from);
          if (sqPiece) chess.put(sqPiece, to);
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
    });

    eventBus.on<string>("fen-updated", (fen) => {
      if (!fen) return;
      host.fen = fen;
      host.markedPos = null;
      eventBus.emit("updateUI");
    });
  },
};
registerGenFENModule("BoardClick", BoardClickModule);
