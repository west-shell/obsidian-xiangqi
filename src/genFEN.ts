import XQPlugin from './main';
import { XQRenderChild } from './xiangqi';
import { MarkdownRenderChild, MarkdownPostProcessorContext } from 'obsidian';
import { createPieceSvg, genBoardSVG } from './svg';
import { IMove, IPiece, IPosition, ISettings, PIECE_CHARS, PieceType } from './types';
import { findPieceAt, markPiece, movePiece, restorePiece } from './utils';
import { parseSource } from './parseSource';
import { runMove } from './action';
interface IPieceBTN extends HTMLButtonElement {
    pieces: IPiece[];
}

export class GenFENRenderChild extends XQRenderChild {
    // fistTurn: 'red' | 'blue' = 'red'; // 默认红方先手
    defaultFEN = {
        full: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR',
        empty: '4k4/9/9/9/9/9/9/9/9/4K4',
    } as const; // 默认选项
    startFEN: keyof typeof this.defaultFEN = 'full'; // 默认选项
    hiddenedPieces: PieceType[] = []; // 隐藏的棋子
    constructor(
        containerEl: HTMLElement,
        ctx: MarkdownPostProcessorContext,
        source: string,
        plugin: XQPlugin,
    ) {
        super(containerEl, ctx, source, plugin);
    }

    onload() {
        this.parseSource();
        // 解析源文本 谁先走
        // 绘制棋盘 棋子按钮
        // 绑定事件
        // 生成按钮
        this.rend()
        this.creatButtons()
    }

    parseSource() {
        this.source = this.defaultFEN[this.startFEN];
        super.parseSource();
    }

    rend() {
        this.rendBoard();
        this.boardSVG!.addEventListener('click', this.handleBoardClick);

    }

    handleBoardClick = (e: MouseEvent) => {
        if (!this.boardSVG) return;
        const cellSize = this.settings.cellSize;
        const boardRect = this.boardSVG.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left;
        const mouseY = e.clientY - boardRect.top;
        let gridX = Math.round(mouseX / cellSize) - 1;
        let gridY = Math.round(mouseY / cellSize) - 1;
        const gridPos = { x: gridX, y: gridY };
        const clickedPiece = findPieceAt(gridPos, this);
        // 你的后续逻辑

        if (!this.markedPiece) {
            // 没有标记棋子时，只能选中当前行棋方的棋子
            if (clickedPiece) {
                markPiece(clickedPiece.pieceEl!);
                this.markedPiece = clickedPiece;
            }
            return;
        } else {
            if (clickedPiece) {
                clickedPiece.hidden = true; // 隐藏目标棋子
                clickedPiece.pieceEl?.setAttribute('display', 'none');
                const pieceTBN = this.containerEl.querySelector(`#piece-${clickedPiece.type}`) as IPieceBTN;
                if (pieceTBN) {
                    pieceTBN.pieces.push(clickedPiece); // 将被吃掉的棋子添加到按钮中
                }
                if (pieceTBN && pieceTBN.pieces?.length > 0) {
                    pieceTBN.style.backgroundColor = 'yellow'; // 如果按钮中有被吃掉的棋子，设置背景色
                }
                if (clickedPiece.position.x === this.markedPiece.position.x && clickedPiece.position.y === this.markedPiece.position.y) {
                    this.markedPiece = null;
                    return;
                }
            }
            if (this.markedPiece.hidden) {
                this.markedPiece.hidden = false; // 如果标记的棋子被隐藏，恢复显示
                this.markedPiece.pieceEl!.removeAttribute('display');
                movePiece(this.markedPiece, { x: -1, y: -1 } as IPosition, gridPos, this); // 移动标记棋子
            } else {
                restorePiece(this.markedPiece.pieceEl!); // 恢复标记棋子
                movePiece(this.markedPiece, this.markedPiece.position, gridPos, this); // 移动标记棋子
            }
            this.markedPiece = null; // 移动后取消标记


            // 清除原位置
            // // 有标记棋子时，尝试走子（无论目标是空还是有棋子）
            // const move: IMove = {
            //     type: this.markedPiece.type,
            //     from: { ...this.markedPiece.position },
            //     to: { ...gridPos },
            // };
            // restorePiece(this.markedPiece.pieceEl!);
            // const { from, to } = move;
            // const fromPiece = findPieceAt(from, this);
            // const toPiece = findPieceAt(to, this);
            // if (!fromPiece) return;
            // // 如果目标有棋子，隐藏目标棋子
            // if (toPiece) {
            //     toPiece.hidden = true;
            //     toPiece.pieceEl?.setAttribute('display', 'none');
            //     const pieceTBN = this.containerEl.querySelector(`#piece-${toPiece.type}`) as IPieceBTN;
            //     console.log(pieceTBN);
            //     if (pieceTBN) {
            //         pieceTBN.pieces.push(toPiece); // 将被吃掉的棋子添加到按钮中
            //     }
            //     if (pieceTBN && pieceTBN.pieces?.length > 0) {
            //         pieceTBN.style.backgroundColor = 'yellow';
            //     }
            // }
            // movePiece(fromPiece, from, to, this);

            // this.markedPiece = null; // 移动后取消标记
        }


    }

    creatButtons() {
        // 创建工具栏容器
        const toolbarContainer = this.containerEl.createEl('div', {
            cls: 'pieceBTN-container',
        });
        toolbarContainer.classList.toggle('right', this.settings.position === 'right');
        toolbarContainer.classList.toggle('bottom', this.settings.position === 'bottom');
        // 遍历 PIECE_CHARS 中的每一个棋子，去掉 'K' 和 'k' 代表的将
        for (const piece in PIECE_CHARS) {
            if (piece === 'K' || piece === 'k') continue;  // 跳过老将

            const title = PIECE_CHARS[piece as PieceType];  // 获取棋子的名称

            // 判断是红方（大写字母）还是黑方（小写字母），并设置不同的类名
            const colorClass = piece === piece.toUpperCase() ? 'red' : 'blue';
            const className = `piece-btn ${colorClass}-piece`;  // 动态类名

            // 创建按钮并设置 id、title、class 等
            const btn = toolbarContainer.createEl('button', {
                text: title,  // 按钮文本
                attr: { id: `piece-${piece}` },  // 设置 id 方便识别点击对象
                cls: className,  // 设置动态 class
            }) as IPieceBTN;
            btn.pieces = [];  // 初始化 pieces 数组，用于存储被吃掉的棋子
            btn.style.backgroundColor = colorClass;  // 设置背景色
            // 绑定点击事件
            btn.addEventListener('click', (e) => this.onPieceBTNClick(e));
        }
    }
    onPieceBTNClick(e: MouseEvent) {
        const btn = e.currentTarget as IPieceBTN;
        if (btn.pieces.length > 0) {
            // 如果已经有标记的棋子，先取消标记
            this.markedPiece = btn.pieces.pop() || null;
        }
        if (btn.pieces.length === 0) {
            btn.style.backgroundColor = 'gray'; // 如果没有被吃掉的棋子，清除背景色
        }
        console.log(btn.pieces, 'btn.pieces');
        console.log(this.markedPiece, 'markedPiece');
    }
}