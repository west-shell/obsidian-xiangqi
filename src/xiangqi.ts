import XQPlugin from './main';
import {
    MarkdownRenderChild,
    MarkdownPostProcessorContext,
    MarkdownView,
    setIcon,
    Notice,
} from 'obsidian';
import { ISettings, IPiece, IMove, IState, IBoard, ITurn } from './types';
import { parseSource, getPGN } from './parseSource';
import { genBoardSVG, createPieceSvg } from './svg';
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
    moveContainer: HTMLDivElement | null = null;
    saveButton: HTMLButtonElement | null = null;

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
        this.containerEl.classList.add('XQ-container');
        this.containerEl.classList.toggle('right', this.settings.position === 'right');
        this.containerEl.classList.toggle('bottom', this.settings.position === 'bottom');
        // 创建棋盘容器
        this.boardContainer = this.containerEl.createDiv({
            cls: `board-container ${this.settings.position}`, // 直接拼接
        });
        const boardSVG = genBoardSVG(this.settings);
        this.boardContainer.prepend(boardSVG);
        // 渲染棋子
        const piecesContainer = this.boardContainer.querySelector('#xiangqi-pieces');
        if (!piecesContainer) return;
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
        this.boardContainer.addEventListener('click', this.handleBoardClick);
        this.creatButtons();
        this.moveContainer = this.containerEl.createEl('div', { cls: 'move-container' });
        this.PGNViewer();
    }
    private PGNViewer() {
        const moveContainer = this.moveContainer;
        if (!moveContainer) return;
        moveContainer.empty();
        let toShow: IMove[] = [];
        if (this.modified) {
            toShow = this.history;
        } else {
            toShow = this.PGN;
        }
        toShow.forEach((move, index) => {
            const btn = moveContainer.createEl('button', {
                text: `${index + 1}`,
                cls: 'move-btn',
                attr: { id: `move-btn-${index + 1}` },
            });
            if (index === this.currentStep - 1) {
                btn.classList.add('active'); // 高亮当前步
            }
            btn.addEventListener('click', () => {
                const diff = index - this.currentStep + 1;
                const moveFunc = diff > 0 ? redoMove : undoMove;
                console.log(this.currentStep, index, diff);
                moveContainer
                    .querySelector(`#move-btn-${this.currentStep}`)
                    ?.classList.remove('active');
                moveContainer.querySelector(`#move-btn-${index + 1}`)?.classList.add('active');
                for (let i = 0; i < Math.abs(diff); i++) {
                    moveFunc(this);
                }
            });
        });
    }
    private creatButtons() {
        // 创建工具栏容器
        const toolbarContainer = this.containerEl.createEl('div', {
            cls: 'toolbar-container',
        });
        toolbarContainer.classList.toggle('right', this.settings.position === 'right');
        toolbarContainer.classList.toggle('bottom', this.settings.position === 'bottom');

        // 重置按钮
        const resetButton = toolbarContainer.createEl('button', {
            attr: { title: '重置' },
            cls: 'toolbar-btn',
        });
        setIcon(resetButton, 'refresh-cw');
        resetButton.addEventListener('click', this.handleResetClick);

        // 回退按钮
        const undoButton = toolbarContainer.createEl('button', {
            attr: { title: '回退' },
            cls: 'toolbar-btn',
        });
        setIcon(undoButton, 'undo-dot');
        undoButton.addEventListener('click', () => {
            undoMove(this);
            this.moveContainer
                ?.querySelector(`#move-btn-${this.currentStep + 1}`)
                ?.classList.remove('active');
            this.moveContainer
                ?.querySelector(`#move-btn-${this.currentStep}`)
                ?.classList.add('active');
        });

        // 前进按钮
        const redoButton = toolbarContainer.createEl('button', {
            attr: { title: '前进' },
            cls: 'toolbar-btn',
        });
        setIcon(redoButton, 'redo-dot');
        redoButton.addEventListener('click', () => {
            redoMove(this);
            this.moveContainer
                ?.querySelector(`#move-btn-${this.currentStep - 1}`)
                ?.classList.remove('active');
            this.moveContainer
                ?.querySelector(`#move-btn-${this.currentStep}`)
                ?.classList.add('active');
        });

        // 保存按钮
        const saveButton = toolbarContainer.createEl('button', {
            attr: { title: '保存' },
            cls: 'toolbar-btn',
        });
        this.saveButton = saveButton;
        setIcon(saveButton, 'save');
        saveButton.addEventListener('click', () => this.handleSaveClick());
        saveButton.classList.toggle('saved', this.PGN.length > 0);
        saveButton.classList.toggle('empty', this.PGN.length === 0);
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
                if (
                    (this.currentTurn === 'red' && clickedIsRed) ||
                    (this.currentTurn === 'black' && !clickedIsRed)
                ) {
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
            this.saveButton?.classList.add('unsaved');
            this.PGNViewer();
        } else {
            // 不能走，取消标记
            restorePiece(this.markedPiece.pieceEl!);
            // 如果点击的是当前方棋子，重新标记
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if (
                    (this.currentTurn === 'red' && clickedIsRed) ||
                    (this.currentTurn === 'black' && !clickedIsRed)
                ) {
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
        this.saveButton?.classList.remove('unsaved');
        this.modified = false; // 重置修改状态
        this.PGNViewer();
        this.currentStep = 0;
    };

    async handleSaveClick() {
        let message = '';
        if (this.history.length === 0 && this.PGN.length === 0) {
            new Notice('PGN记录为空，无需保存！');
            return;
        }
        if (this.history.length === 0 && this.PGN.length > 0)
            message = '当前PGN记录不为空，是否要清空？';
        if (this.history.length > 0 && this.PGN.length === 0)
            message = '当前PGN记录为空，是否要保存历史为PGN？';
        if (this.history.length > 0 && this.PGN.length > 0)
            message = '当前PGN记录不为空，是否要覆盖保存？';
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
        const newContent = [
            ...lines.slice(0, lineStart),
            ...blockLines,
            ...lines.slice(lineEnd + 1),
        ].join('\n');
        await this.plugin.app.vault.modify(file, newContent);
    }
    refresh() {
        this.rend();
    }
    // 卸载相关方法
    onunload() {
        this.plugin.renderChildren.delete(this);
    }
}
