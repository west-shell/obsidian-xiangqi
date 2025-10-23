import type { IPosition } from "../../types";
import { registerGenFENModule } from "../../core/module-system";

export class BoardClickModule {

    static init(host: Record<string, any>) {
        const eventBus = host.eventBus;
        eventBus.on('click', (clickedPos: IPosition) => {
            const clickedPiece = host.board[clickedPos.x][clickedPos.y];
            if (!host.markedPos && !host.selectedPiece) {
                if (clickedPiece) {
                    host.markedPos = clickedPos;
                    host.Xiangqi.$set({
                        markedPos: { ...host.markedPos },
                    });
                }
            } else if (host.markedPos && !host.selectedPiece) {
                const from = host.markedPos
                const to = clickedPos
                host.board[to.x][to.y] = host.board[from.x][from.y];
                host.board[from.x][from.y] = '';
                host.markedPos = null;
                host.Xiangqi.$set({
                    board: [...host.board.map((row: any) => [...row])],
                    markedPos: host.markedPos,
                });
            } else if (host.selectedPiece) {
                host.board[clickedPos.x][clickedPos.y] = host.selectedPiece;
                host.selectedPiece = null;
                host.markedPos = null; // 之前漏掉了这一行，现在补上
                host.Xiangqi.$set({
                    board: [...host.board.map((row: any) => [...row])],
                    selectedPiece: host.selectedPiece,
                    markedPos: host.markedPos,
                });
            }
        })
    }
}
registerGenFENModule('BoardClick', BoardClickModule);
