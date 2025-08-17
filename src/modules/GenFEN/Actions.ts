import { MarkdownView, Notice } from "obsidian";
import { registerGenFENModule } from "../../core/module-system";
import type { IBoard, IGenFENHost, ITurn } from "../../types";

export class ActionsModule {
    static init(host: IGenFENHost) {
        const eventBus = host.eventBus;

        eventBus.on("clickPieceBTN", (piece) => {
            if (!piece) return;
            host.markedPos = null;
            host.selectedPiece = piece;
            host.eventBus.emit('updateUI');
        })

        eventBus.on("btn-click", (action) => {
            if (!action) return;
            switch (action) {
                case 'turn':
                    host.currentTurn = host.currentTurn === 'red' ? 'black' : 'red';
                    break
                case 'empty':
                    host.board = Array.from({ length: 10 }, () => Array(9).fill(null));
                    host.board[4][0] = 'k';
                    host.board[4][9] = 'K'
                    host.selectedPiece = null
                    host.markedPos = null;
                    break
                case 'full':
                    host.eventBus.emit('full');
                    host.selectedPiece = null
                    host.markedPos = null;
                    break
                case 'save':
                    onSaveBTNClick(host);
                    break
            }
            eventBus.emit('updateUI');
        })
    }
}

registerGenFENModule('actions', ActionsModule)

async function onSaveBTNClick(host: IGenFENHost) {
    // 1. 生成 FEN
    const fen = genFENFromBoard(host.board, host.currentTurn);
    // 2. 获取当前 markdown 编辑器视图和文件
    const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const file = view.file;
    if (!file) return;

    // 3. 获取当前代码块的 section 信息
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return;
    const { lineStart, lineEnd } = section;

    // 4. 读取文件内容并分行
    const content = await host.plugin.app.vault.read(file);
    const lines = content.split("\n");

    // 5. 获取代码块内容行
    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);
    if (blockLines.length < 2) return;

    // 6. 判断并替换代码块类型为 xiangqi，内容为 FEN
    // 只替换代码块首尾行，内容只保留 FEN
    blockLines[0] = blockLines[0].replace(/^```xq\b.*$/, "```xiangqi");
    blockLines = [blockLines[0], `[FEN "${fen}"]`, "```"];

    // 7. 拼接新内容并写回
    const newContent = [
        ...lines.slice(0, lineStart),
        ...blockLines,
        ...lines.slice(lineEnd + 1),
    ].join("\n");

    host.plugin.app.vault.process(file, () => newContent);
    new Notice("FEN已保存到代码块");
}
function genFENFromBoard(board: IBoard, turn: ITurn): string {
    // board[x][y]，x为列，y为行
    const rows: string[] = [];
    for (let y = 0; y < 10; y++) {
        let fenRow = "";
        let empty = 0;
        for (let x = 0; x < 9; x++) {
            const cell = board[x][y];
            if (!cell) {
                empty++;
            } else {
                if (empty > 0) {
                    fenRow += empty;
                    empty = 0;
                }
                fenRow += cell;
            }
        }
        if (empty > 0) fenRow += empty;
        rows.push(fenRow);
    }
    const fen = rows.join("/");
    return `${fen} ${turn === "red" ? "w" : "b"}`;
}
