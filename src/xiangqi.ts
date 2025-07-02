import XQPlugin from './main';
import { MarkdownRenderChild, MarkdownPostProcessorContext } from 'obsidian';
import { redoMove, runMove } from './action';
import { parseSource, getWXF } from './parseSource';
import { isValidMove } from './rules';
import { showActiveBTN, showMoveList } from './moveList';
import { genBoardSVG, createPieceSvg, updateRectStroke } from './svg';
import { ISettings, IMove, IBoard, IPiece, ITurn } from './types';
import { IOptions } from './parseSource';
import { findPieceAt, markPiece, restorePiece, scrollToBTN } from './utils';
import { creatButtons } from './buttons';

export class XQRenderChild extends MarkdownRenderChild {
    source: string; // 保存源文本
    settings: ISettings;
    options: IOptions = {};
    haveFEN: boolean = false;
    PGN: IMove[] = [];
    board: IBoard = [];
    pieces: IPiece[] = [];
    boardSVG: SVGSVGElement | null = null;
    boardRect: SVGRectElement | null = null;
    markedPiece: IPiece | null = null;
    history: IMove[] = [];
    currentTurn: ITurn = 'red'; // 新增，默认红方先手
    currentStep: number = 0;
    modified: boolean = false;
    modifiedStep: number = 0;
    toolbarContainer: HTMLDivElement | null = null;
    moveContainer: HTMLDivElement | null = null;
    saveButton: HTMLButtonElement | null = null;
    plugin: XQPlugin;
    ctx: MarkdownPostProcessorContext;

    constructor(
        containerEl: HTMLElement,
        ctx: MarkdownPostProcessorContext,
        source: string,
        plugin: XQPlugin,
    ) {
        super(containerEl);
        this.plugin = plugin;
        this.settings = plugin.settings;
        this.source = source;
        this.ctx = ctx;
        this.containerEl = containerEl;
        parseSource(source); // 解析源文本
    }

    // 主函数
    onload() {
        this.plugin.renderChildren.add(this);
        this.parseSource();
        this.rend();
    }
    // 解析相关私有方法
    parseSource() {
        const { haveFEN, pieces, board, PGN, firstTurn, options } = parseSource(this.source);
        this.options = options || {};
        this.haveFEN = haveFEN;
        this.pieces = pieces;
        this.board = board;
        this.PGN = PGN;
        this.currentTurn = firstTurn;
        this.options = options || {};
    }
    rend() {
        this.settings = { ...this.plugin.settings, ...this.options }; // 从插件中获取设置

        this.rendBoard();

        this.boardSVG!.addEventListener('click', this.handleBoardClick);

        creatButtons(this);

        this.autoJump();

        this.creatMoveList();
    }
    rendBoard() {
        this.containerEl.empty();
        this.containerEl.classList.add('XQ-container');
        const position = this.settings.position;
        this.containerEl.classList.toggle('right', this.settings.position === 'right');
        this.containerEl.classList.toggle('bottom', this.settings.position === 'bottom');
        // if (position === 'bottom') {
        //     this.containerEl.style.width = `${10* this.settings.cellSize}px`;
        //     this.containerEl.style.height = '';
        // }
        // if (position === 'right') {
        //     this.containerEl.style.width = '';
        //     this.containerEl.style.height = `${11 * this.settings.cellSize}px`;
        // }
        // 创建棋盘容器
        const boardContainer = this.containerEl.createDiv({
            cls: `board-container ${this.settings.position}`, // 直接拼接
        });
        this.boardSVG = genBoardSVG(this.settings, this.options) as SVGSVGElement;
        if (this.options.rotated) {
            this.boardSVG.setAttribute('transform', 'rotate(180)');
        }
        boardContainer.prepend(this.boardSVG);
        this.boardRect = this.boardSVG.getElementById('boardRect') as SVGRectElement | null;
        updateRectStroke(this);
        // 渲染棋子
        const piecesContainer = this.boardSVG.querySelector('#xiangqi-pieces');
        if (!piecesContainer) return;
        piecesContainer.empty();
        this.pieces.forEach((piece, index) => {
            const pieceEL = createPieceSvg(piece, this.settings, this.options);
            piecesContainer.appendChild(pieceEL!);
            const pieceEl = piecesContainer.lastElementChild;
            if (pieceEl) {
                this.pieces[index].pieceEl = pieceEl;
                if (piece.hidden) {
                    pieceEl.setAttribute('display', 'none'); // 隐藏棋子
                }
            }
        });
    }
    handleBoardClick = (e: MouseEvent) => {
        const clickedPos = this.getClickedPos(e);
        if (!clickedPos) return; // 如果没有点击到棋盘或棋盘不存在，直接返回
        const clickedPiece = findPieceAt(clickedPos, this);
        // 你的后续逻辑
        if (!this.markedPiece) {
            // 没有标记棋子时，只能选中当前行棋方的棋子
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if (
                    (this.currentTurn === 'red' && clickedIsRed) ||
                    (this.currentTurn === 'blue' && !clickedIsRed)
                ) {
                    markPiece(clickedPiece.pieceEl!);
                    this.markedPiece = clickedPiece;
                }
            }
            return;
        }

        // 有标记棋子时，尝试走子（无论目标是空还是有棋子）
        const moveValid = isValidMove(this.markedPiece.position, clickedPos, this.board);

        if (moveValid) {
            const move: IMove = {
                type: this.markedPiece.type,
                from: { ...this.markedPiece.position },
                to: { ...clickedPos },
            };
            move.WXF = getWXF(move, this.board);
            restorePiece(this.markedPiece.pieceEl!);
            if (!this.modified) this.modifiedStep = this.currentStep;
            this.modified = true;
            runMove(move, this);
            this.markedPiece = null; // 移动后取消标记
            this.saveButton?.classList.add('unsaved');
            showMoveList(this);
            showActiveBTN(this);
        } else {
            // 不能走，取消标记
            restorePiece(this.markedPiece.pieceEl!);
            // 如果点击的是当前方棋子，重新标记
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if (
                    (this.currentTurn === 'red' && clickedIsRed) ||
                    (this.currentTurn === 'blue' && !clickedIsRed)
                ) {
                    markPiece(clickedPiece.pieceEl!);
                    this.markedPiece = clickedPiece;
                    return;
                }
            }
            this.markedPiece = null;
        }
    };
    getClickedPos(e: MouseEvent): { x: number; y: number } | null {
        if (!this.boardSVG) return null;
        const cellSize = this.settings.cellSize;
        const boardRect = this.boardSVG.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left;
        const mouseY = e.clientY - boardRect.top;
        let gridX = Math.round(mouseX / cellSize) - 1;
        let gridY = Math.round(mouseY / cellSize) - 1;
        if (this.options.rotated) {
            // 如果棋盘是旋转的，调整坐标
            gridX = 8 - gridX;
            gridY = 9 - gridY;
        }
        return { x: gridX, y: gridY };
    }
    autoJump() {
        switch (this.settings.autoJump) {
            case 'never':
                break;
            case 'always':
                if (this.PGN.length > 0) {
                    for (let i = 0; i < this.PGN.length; i++) {
                        redoMove(this);
                    }
                    break;
                }
            case 'auto':
                if (this.PGN.length > 0 && !this.haveFEN) {
                    this.PGN.forEach(() => redoMove(this));
                    break;
                }
                break;
        }
    }
    creatMoveList() {
        if (this.settings.showPGN) {
            this.moveContainer = this.containerEl.createEl('div', { cls: 'move-container' });
            if (this.settings.position === 'right') {
                this.moveContainer.classList.add('right');
                this.moveContainer.style.height = `${11 * this.settings.cellSize}px`;
            } else if (this.settings.position === 'bottom') {
                this.moveContainer.classList.add('bottom');
                this.moveContainer.style.width = `${10 * this.settings.cellSize}px`;
            }
            showMoveList(this);
            if (
                (this.settings.autoJump === 'auto' && !this.haveFEN) ||
                this.settings.autoJump === 'always'
            ) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.moveContainer!.scrollTo({
                            top: this.moveContainer!.scrollHeight,
                            behavior: 'smooth',
                        });
                    });
                });
            }
        }
    }

    refresh() {
        this.rend();
    }

    // 卸载相关方法
    onunload() {
        this.plugin.renderChildren.delete(this);
    }
}
