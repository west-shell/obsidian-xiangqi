import XQPlugin from './main';
import { MarkdownRenderChild, MarkdownPostProcessorContext, MarkdownView, Notice } from 'obsidian';
import { ISettings, IPiece, IMove, IState, IBoard, ITurn } from './types';
import { parseSource, getPGN } from './parseSource';
import { generateBoardSvg, createPieceSvg, createButtonSvg } from './svg';
import { isValidMove } from './rules';
import { runMove, undoMove, redoMove } from './action';
import { findPieceAt, markPiece, restorePiece } from './utils';
import { ConfirmModal } from './confirmModal';

export class XQRenderChild extends MarkdownRenderChild implements IState {
    settings: ISettings;
    PGN: IMove[] = [];
    boardContainer: HTMLDivElement | null = null;
    toolbarContainer: HTMLDivElement | null = null;
    board: IBoard = [];
    pieces: IPiece[] = [];
    markedPiece: IPiece | null = null;
    history: IMove[] = [];
    currentTurn: ITurn = 'red'; // 新增，默认红方先手
    currentStep: number = 0;
    modified: boolean = false;

    constructor(
        public containerEl: HTMLElement,
        private ctx: MarkdownPostProcessorContext,
        private source: string,
        private plugin: XQPlugin,
    ) {
        super(containerEl);
        this.settings = plugin.settings; // 从插件中获取设置
    }

    // 主函数
    onload() {
        this.plugin.renderChildren.add(this);
        this.parseSource();
        this.rend();
        this.bindEvents();
    }
    // 解析相关私有方法
    private parseSource() {
        const { pieces, board, PGN, firstTurn } = parseSource(this.source);
        this.pieces = pieces;
        this.board = board;
        this.PGN = PGN;
        this.currentTurn = firstTurn;
    }
    private rend() {
        this.containerEl.empty();
        // 创建棋盘容器
        this.boardContainer = this.containerEl.createDiv({ cls: 'xiangqi-container' });
        const boardSvg = generateBoardSvg(this.settings);
        this.boardContainer.prepend(boardSvg);
        // 渲染棋子
        const piecesContainer = this.boardContainer.querySelector('#xiangqi-pieces');
        if (!piecesContainer) {
            return;
        }
        piecesContainer.empty();
        this.pieces.forEach((piece, index) => {
            const pieceEL = createPieceSvg(piece, this.settings);
            piecesContainer.appendChild(pieceEL!);
            const pieceEl = piecesContainer.lastElementChild;
            if (pieceEl) {
                this.pieces[index].pieceEl = pieceEl;
                if (piece.hidden) {
                    pieceEl.setAttribute('display', 'none'); // 隐藏棋子
                }
            }
        });

        const toolbar = this.boardContainer.querySelector('#toolbar');
        this.toolbarContainer = toolbar as HTMLDivElement;
        if (toolbar) {
            toolbar.empty(); // 清空现有内容
            const buttonGroup = createButtonSvg(this.settings); // 返回 <g>...</g> 的 Element
            // 假设 #toolbar 是 <svg> 或 <g> 节点
            toolbar.appendChild(buttonGroup);
        }
        const saveButton = this.toolbarContainer!.querySelector('#save');
        if (saveButton) {
            const circle = saveButton.querySelector('circle');
            if (circle) {
                circle.setAttribute('fill', this.PGN.length > 0 ? 'green' : '#FF9500');
            }
        }
    }
    private bindEvents() {
        // 只绑定一次棋盘点击事件
        this.boardContainer?.addEventListener('click', this.handleBoardClick);
        const resetButton = this.toolbarContainer!.querySelector('#reset');
        resetButton?.addEventListener('click', this.handleResetClick);
        const undoButton = this.toolbarContainer!.querySelector('#undo');
        undoButton?.addEventListener('click', () => undoMove(this));
        const redoButton = this.toolbarContainer!.querySelector('#redo');
        redoButton?.addEventListener('click', () => redoMove(this));
        const saveButton = this.toolbarContainer!.querySelector('#save');
        saveButton?.addEventListener('click', () => this.handleSaveClick());
    }
    private handleBoardClick = (e: MouseEvent) => {
        if (!this.boardContainer) return;
        const cellSize = this.settings.cellSize;
        const boardRect = this.boardContainer.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left;
        const mouseY = e.clientY - boardRect.top;
        const gridX = Math.round(mouseX / cellSize) - 1;
        const gridY = Math.round(mouseY / cellSize) - 1;
        const gridPos = { x: gridX, y: gridY };
        const clickedPiece = findPieceAt(gridPos, this);

        if (!this.markedPiece) {
            // 没有标记棋子时，只能选中当前行棋方的棋子
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if ((this.currentTurn === 'red' && clickedIsRed) || (this.currentTurn === 'black' && !clickedIsRed)) {
                    markPiece(clickedPiece.pieceEl!);
                    this.markedPiece = clickedPiece;
                }
            }
            return;
        }

        // 有标记棋子时，尝试走子（无论目标是空还是有棋子）
        const moveValid = isValidMove(this.markedPiece.position, gridPos, this.board);

        if (moveValid) {
            const move: IMove = {
                from: { ...this.markedPiece.position },
                to: { ...gridPos },
            };
            restorePiece(this.markedPiece.pieceEl!);
            runMove(move, this);
            this.markedPiece = null; // 移动后取消标记
            this.modified = true; // 标记为已修改
        } else {
            // 不能走，取消标记
            restorePiece(this.markedPiece.pieceEl!);
            // 如果点击的是当前方棋子，重新标记
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if ((this.currentTurn === 'red' && clickedIsRed) || (this.currentTurn === 'black' && !clickedIsRed)) {
                    markPiece(clickedPiece.pieceEl!);
                    this.markedPiece = clickedPiece;
                    return;
                }
            }
            this.markedPiece = null;
        }
    };

    private handleResetClick = () => {
        while (this.currentStep > 0) {
            undoMove(this); // 撤销上一步
        }
        this.history = [];
        this.modified = false; // 重置修改状态
        this.currentStep = 0;
    };

    refresh() {
        this.rend();
        this.bindEvents();
    }
    // 卸载相关方法
    onunload() {
        this.plugin.renderChildren.delete(this);
    }
    async handleSaveClick() {
        let message = '';
        if (this.history.length === 0 && this.PGN.length === 0) {
            new Notice('PGN记录为空，无需保存！');
            return;
        }
        if (this.history.length === 0 && this.PGN.length > 0) message = '当前PGN记录不为空，是否要清空？';
        if (this.history.length > 0 && this.PGN.length === 0) message = '当前PGN记录为空，是否要保存历史为PGN？';
        if (this.history.length > 0 && this.PGN.length > 0) message = '当前PGN记录不为空，是否要覆盖保存？';
        const modal = new ConfirmModal(this.plugin.app, '确认保存', message, '保存', '取消');

        modal.open();
        const userConfirmed = await modal.promise;

        if (userConfirmed) {
            await this.savePGN();
            new Notice('保存成功！');
        }
    }
    async savePGN() {
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const file = view.file; // TFile
        if (!file) return;
        const section = this.ctx.getSectionInfo(this.containerEl);
        if (!section) return;
        const { lineStart, lineEnd } = section;
        const content = await this.plugin.app.vault.read(file);
        const lines = content.split('\n');
        let blockLines = lines.slice(lineStart, lineEnd + 1);
        if (blockLines.length < 2) return;
        // 1. 删除所有符合 PGN 格式的行（无论 currentStep 是多少）
        blockLines = blockLines.filter((line) => !/[A-Z]\d-[A-Z]\d/.test(line));
        // 2. 仅当 currentStep > 0 时生成并插入新的 PGN
        if (this.currentStep > 0) {
            const moves = this.history.slice(0, this.currentStep).map((move) => getPGN(move));
            let pgnLines = [];
            for (let i = 0; i < moves.length; i += 2) {
                const line = `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ''}`.trim();
                pgnLines.push(line);
            }
            const PGN = pgnLines.join('\n');
            blockLines.splice(blockLines.length - 1, 0, PGN);
        }
        // 3. 更新文件内容（无论是否插入 PGN，都会执行清理）
        const newContent = [...lines.slice(0, lineStart), ...blockLines, ...lines.slice(lineEnd + 1)].join('\n');
        await this.plugin.app.vault.modify(file, newContent);
    }
}
