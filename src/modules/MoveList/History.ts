import { registerXQModule } from "../../core/module-system";
import { getWXF, getICCS } from "../../utils/parse"; // 导入 getICCS
import type { IMove } from "../../types";

export const HistoryModule = {

    init(host: Record<string, any>) {
        const eventBus = host.eventBus;

        eventBus.on("load", () => {
            host.modified = false;
            host.history = [];
        })

        eventBus.on("edithistory", (move: IMove) => {
            editHistory(host, move);
        })
    }
}

function editHistory(host: Record<string, any>, move: IMove) {
    move.WXF = getWXF(move, host.board);
    move.captured = host.board[move.to.x][move.to.y];
    move.ICCS = getICCS(move); // 添加：计算并设置 ICCS
    let { currentStep, history } = host;
    const currentMove = move;

    // 检查当前步骤是否已存在相同的 move
    const existingMove = history[currentStep];
    if (
        existingMove &&
        existingMove.from.x === currentMove.from.x &&
        existingMove.from.y === currentMove.from.y &&
        existingMove.to.x === currentMove.to.x &&
        existingMove.to.y === currentMove.to.y
    ) {
    }

    // 不同则：
    // 1. 删除 currentStep 之后的所有历史
    host.history.splice(currentStep);

    // 2. 添加新 move（直接 push 到原数组）
    host.history.push(currentMove);
}

registerXQModule('history', HistoryModule);
