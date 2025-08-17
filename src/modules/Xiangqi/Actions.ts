import { MarkdownView, Notice } from "obsidian";
import { registerXQModule } from "../../core/module-system";
import type { IMove, IXQHost, PieceType } from "../../types";
import { getICCS } from "../../utils/parse";
import { ConfirmModal } from "../../utils/confirmModal";

export class ActionsModule {
    static init(host: IXQHost) {
        const eventBus = host.eventBus;

        eventBus.on('runmove', (move) => {
            if (!move) return;
            eventBus.emit('edithistory', move);
            runmove(host, move);
            eventBus.emit('updateUI', 'runmove');
        })

        eventBus.on('undo', () => {
            undo(host);
            eventBus.emit('updateUI', 'undo');
        })

        eventBus.on('redo', () => {
            redo(host);
            eventBus.emit('updateUI', 'redo');
        })

        eventBus.on('toStart', () => {
            while (host.currentStep != 0) {
                undo(host);
            }
            eventBus.emit('updateUI', 'toStart');
        })

        eventBus.on('toEnd', () => {
            const step = host.modified ? host.history.length : host.PGN.length;
            const dif = step - host.currentStep;
            for (let i = 0; i < dif; i++) {
                redo(host);
            }
            eventBus.emit('updateUI', 'toEnd');
        })

        eventBus.on('reset', () => {
            if (host.modified) {
                while (host.currentStep != 0) {
                    undo(host);
                }
                host.modified = false;
                host.history = [];
                if (host.modifiedStep) {
                    for (let i = 0; i < host.modifiedStep; i++) {
                        redo(host);
                    }
                }
                host.modifiedStep = null;
                eventBus.emit('updateUI', 'reset');
            } else {
                eventBus.emit('toStart');
            }
        })

        eventBus.on('save', async () => {
            let message = "";
            if (host.history.length === 0 && host.PGN.length === 0) {
                new Notice("历史记录和PGN记录为空，无需保存！");
                return;
            }
            if (host.history.length === 0 && host.PGN.length > 0)
                message = "当前PGN记录不为空，是否要清空？";
            if (host.history.length > 0 && host.PGN.length === 0)
                message = "当前PGN记录为空，是否要保存历史为PGN？";
            if (host.history.length > 0 && host.PGN.length > 0)
                message = "当前PGN记录不为空，是否要覆盖保存？";
            const modal = new ConfirmModal(
                host.plugin.app,
                "确认保存",
                message,
                "保存",
                "取消",
            );

            modal.open();
            const userConfirmed = await modal.promise;

            if (userConfirmed) {
                await savePGN(host);
                new Notice("保存成功！");
            }
            eventBus.emit('updateUI', 'save');
        })

        eventBus.on('clickstep', (step) => {
            if (step === undefined) return;
            const dif = step - host.currentStep;
            if (dif === 0) return;
            if (dif > 0) {
                for (let i = 0; i < dif; i++) {
                    redo(host);
                }
            } else {
                for (let i = 0; i < -dif; i++) {
                    undo(host);
                }
            }
            eventBus.emit('updateUI');
        })
    }
}

registerXQModule('actions', ActionsModule);

function runmove(host: IXQHost, move: IMove) {
    const { from, to } = move;
    host.board[to.x][to.y] = host.board[from.x][from.y];
    host.board[from.x][from.y] = null;
    host.currentStep++;
    host.currentTurn = host.currentTurn === 'red' ? 'black' : 'red';
}

function undo(host: IXQHost) {
    host.markedPos = null
    if (host.history.length === 0) return;
    const move = host.history[host.currentStep - 1];
    if (!move) return;
    const { from, to, captured } = move;
    // 找到需要回退的棋子
    const returnPiece = host.board[to.x][to.y];
    host.board[from.x][from.y] = returnPiece;
    host.board[to.x][to.y] = null;

    // 恢复被吃掉的棋子
    if (captured) {
        host.board[to.x][to.y] = captured as PieceType;
    }
    host.currentStep--;
    host.currentTurn = host.currentTurn === "red" ? "black" : "red";
}

function redo(host: IXQHost) {
    host.markedPos = null;
    const eventBus = host.eventBus;
    if (!host.modified && host.PGN.length > 0) {
        const nextMove = host.PGN[host.currentStep]; // 获取并移除 moves 中的第一步
        if (!nextMove) return;
        eventBus.emit('edithistory', nextMove);
        runmove(host, nextMove);

    } else {
        if (host.history.length < host.currentStep) return;
        // 如果有悔棋记录，从 undoHistory 中执行下一步
        const moveToRedo = host.history[host.currentStep];
        if (!moveToRedo) return;
        runmove(host, moveToRedo);

    }
}

async function savePGN(host: IXQHost) {
    const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const file = view.file;
    if (!file) return;

    // 这里 this.containerEl 可能指当前实例的属性，确保 this 指向正确
    // 如果 savePGN 是类方法，建议改写为箭头函数或 bind this
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return;

    const { lineStart, lineEnd } = section;
    const content = await host.plugin.app.vault.read(file);
    const lines = content.split("\n");

    // 明确标注类型，初始赋值时用slice保证是string[]
    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);

    if (blockLines.length < 2) return;

    // 1. 删除所有符合 PGN 格式的行（无论 currentStep 是多少）
    blockLines = blockLines.filter((line) => !/[A-Z]\d-[A-Z]\d/.test(line));

    // 2. 仅当 currentStep > 0 时生成并插入新的 PGN
    if (host.currentStep > 0) {
        const moves = host.history
            .slice(0, host.currentStep)
            .map((move: IMove) => getICCS(move));

        const pgnLines: string[] = [];
        for (let i = 0; i < moves.length; i += 2) {
            const line =
                `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ""}`.trim();
            pgnLines.push(line);
        }
        const PGN = pgnLines.join("\n");

        // 插入PGN字符串
        blockLines.splice(blockLines.length - 1, 0, PGN);
    }

    // 3. 更新文件内容（无论是否插入 PGN，都会执行清理）
    const newContent = [
        ...lines.slice(0, lineStart),
        ...blockLines,
        ...lines.slice(lineEnd + 1),
    ].join("\n");

    host.plugin.app.vault.process(file, () => newContent);
}
