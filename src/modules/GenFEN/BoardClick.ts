import { Chess } from "@west-shell/xiangqi.js";
import type { Square } from "@west-shell/xiangqi.js";
import { registerGenFENModule } from "../../core/module-system";

const BoardClickModule = {
    init(host: Record<string, any>) {
        const eventBus = host.eventBus;

        eventBus.on('click', (clickedKey: string) => {
            const chess = new Chess(host.fen, { skipValidation: true });

            if (!host.markedPos && !host.selectedPiece) {
                const piece = chess.get(clickedKey as Square);
                if (piece) {
                    host.markedPos = clickedKey;
                    eventBus.emit('updateUI');
                }
            } else if (host.markedPos && !host.selectedPiece) {
                const from = host.markedPos as Square;
                const to = clickedKey as Square;
                const piece = chess.get(from);
                if (piece) {
                    chess.remove(to);
                    const sqPiece = chess.get(from);
                    chess.remove(from);
                    if (sqPiece) chess.put(sqPiece, to);
                    host.fen = chess.fen();
                    host.markedPos = null;
                    eventBus.emit('updateUI');
                } else {
                    host.markedPos = null;
                    eventBus.emit('updateUI');
                }
            } else if (host.selectedPiece) {
                chess.remove(clickedKey as Square);
                if (host.selectedPiece) {
                    const color = host.selectedPiece === host.selectedPiece.toUpperCase() ? 'w' : 'b';
                    const type = host.selectedPiece.toLowerCase();
                    chess.put({ type: type as any, color }, clickedKey as Square);
                }
                host.fen = chess.fen();
                host.selectedPiece = null;
                host.markedPos = null;
                eventBus.emit('updateUI');
            }
        })

        eventBus.on('fen-updated', (fen: string) => {
            if (!fen) return;
            host.fen = fen;
            host.markedPos = null;
            eventBus.emit('updateUI');
        })
    }
}
registerGenFENModule('BoardClick', BoardClickModule);
