import type { IMove, IPosition } from "../../types";
import { isValidMove } from "../../utils/rules";
import { registerXQModule, registerPGNViewModule } from "../../core/module-system";

export class BoardClickModule {

    static init(host: Record<string, any>) {
        const eventBus = host.eventBus;
        eventBus.on('click', (clickedPos: IPosition) => {
            const clickedPiece = host.board[clickedPos.x][clickedPos.y];
            // 你的后续逻辑
            if (!host.markedPos) {
                // 没有标记棋子时，只能选中当前行棋方的棋子
                if (clickedPiece) {
                    const clickedIsRed =
                        clickedPiece === clickedPiece.toUpperCase();
                    if (
                        (host.currentTurn === "red" && clickedIsRed) ||
                        (host.currentTurn != "red" && !clickedIsRed)
                    ) {
                        host.markedPos = clickedPos;
                        host.Xiangqi.$set({
                            markedPos: { ...host.markedPos },
                        });
                    }
                }
                return;
            }

            const moveValid = isValidMove(
                host.markedPos,
                clickedPos,
                host.board,
            );

            if (moveValid) {
                const move: IMove = {
                    from: { ...host.markedPos },
                    to: { ...clickedPos },
                };
                if (!host.modified) host.modifiedStep = host.currentStep;
                host.modified = true;
                host.markedPos = null;
                eventBus.emit('runmove', move);
            } else {
                // 不能走，取消标记
                // restorePiece(host.markedPiece.pieceEl!);
                // 如果点击的是当前方棋子，重新标记
                if (clickedPiece) {
                    const clickedIsRed =
                        clickedPiece === clickedPiece.toUpperCase();
                    if (
                        (host.currentTurn === "red" && clickedIsRed) ||
                        (host.currentTurn === "black" && !clickedIsRed)
                    ) {
                        host.markedPos = clickedPos;
                        host.Xiangqi.$set({ markedPos: host.markedPos });
                        return;
                    }
                }
                host.markedPos = null;
                host.Xiangqi.$set({
                    markedPos: host.markedPos,
                });
            }

        })
    }
}
registerXQModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
