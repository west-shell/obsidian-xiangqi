import XQPlugin from './main';
import { XQRenderChild } from './xiangqi';
import { MarkdownPostProcessorContext } from 'obsidian';
import { themes } from './svg';
import { IPiece, PIECE_CHARS, PieceType } from './types';
import { findPieceAt, markPiece, movePiece, restorePiece } from './utils';

interface IPieceBTN extends HTMLButtonElement {
    pieces: IPiece[];
    updateStyle?: (state: XQRenderChild) => void; // 可选方法，用于更新按钮样式
}

export class GenFENRenderChild extends XQRenderChild {
    // fistTurn: 'red' | 'blue' = 'red'; // 默认红方先手
    defaultFEN = {
        full: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR',
        empty: '4k4/9/9/9/9/9/9/9/9/4K4',
    } as const; // 默认选项
    startFEN: keyof typeof this.defaultFEN = 'full'; // 默认选项
    hiddenedPieces: PieceType[] = []; // 隐藏的棋子
    pieceBTNs: IPieceBTN[] = []; // 棋子按钮
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
        const clickedPos = this.getClickedPos(e)
        if (!clickedPos) return; // 如果没有点击到棋盘或棋盘不存在，直接返回
        const clickedPiece = findPieceAt(clickedPos, this);
        // 你的后续逻辑
        // 无选中则选中
        if (!this.markedPiece) {
            // 没有标记棋子时，只能选中当前行棋方的棋子
            if (clickedPiece) {
                markPiece(clickedPiece.pieceEl!);
                this.markedPiece = clickedPiece;
            }
            return;
        }
        // 选中了按钮
        if (this.markedPiece.hidden) {
            const markedBTN = this.getPieceBTN(this.markedPiece.type);
            this.markedPiece.hidden = false;
            this.markedPiece.pieceEl!.removeAttribute('display');
            movePiece(this.markedPiece, null, clickedPos, this);
            this.markedPiece = null; // 移动后取消标记
            markedBTN?.updateStyle?.(this); // 更新按钮样式

            if (clickedPiece) {
                clickedPiece.hidden = true; // 隐藏目标棋子
                clickedPiece.pieceEl?.setAttribute('display', 'none');
                const pieceTBN = this.getPieceBTN(clickedPiece.type);
                pieceTBN?.pieces.push(clickedPiece); // 将被吃掉的棋子添加到按钮中
                pieceTBN?.updateStyle?.(this); // 更新按钮样式
            }
            return
        }
        else {// 有标记棋子时
            if (this.markedPiece === clickedPiece) {
                restorePiece(this.markedPiece.pieceEl!); // 恢复标记棋子
                this.markedPiece.hidden = true;
                this.markedPiece.pieceEl!.setAttribute('display', 'none');
                const btn = this.getPieceBTN(this.markedPiece.type);
                btn?.pieces.push(this.markedPiece); // 将被吃掉的棋子添加 to按钮中
                this.markedPiece = null; // 移动后取消标记
                btn?.updateStyle?.(this); // 更新按钮样式
                return;
            }
            restorePiece(this.markedPiece.pieceEl!); // 恢复标记棋子
            movePiece(this.markedPiece, this.markedPiece.position, clickedPos, this);
            if (clickedPiece) {
                clickedPiece.hidden = true; // 隐藏目标棋子
                clickedPiece.pieceEl?.setAttribute('display', 'none');
                const pieceTBN = this.getPieceBTN(clickedPiece.type);
                pieceTBN?.pieces.push(clickedPiece); // 将被吃掉的棋子添加到按钮中
                pieceTBN?.updateStyle?.(this); // 更新按钮样式
            }
            this.markedPiece = null; // 移动后取消标记
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
            const title = PIECE_CHARS[piece as PieceType];  // 获取棋子的名称
            const isRed = piece === piece.toUpperCase();
            // 判断是红方（大写字母）还是黑方（小写字母），并设置不同的类名
            const colorClass = isRed ? 'red' : 'blue';
            const className = `piece-btn ${colorClass}-piece`;  // 动态类名

            // 创建按钮并设置 id、title、class 等
            const btn = toolbarContainer.createEl('button', {
                text: title,  // 按钮文本
                attr: { id: `piece-${piece}` },  // 设置 id 方便识别点击对象
                cls: className
            }) as IPieceBTN;
            btn.pieces = [];  // 初始化 pieces 数组，用于存储被吃掉的棋子
            const { red, blue } = themes[this.settings.theme]
            btn.style.backgroundColor = isRed ? red : blue;
            btn.updateStyle = function (state: XQRenderChild) {
                this.classList.toggle('empty', (this.pieces.length === 0))
                const isActive = ((state.markedPiece?.hidden ?? false) && state.markedPiece?.type === piece)
                console.log(state.markedPiece?.hidden, 'hidden')
                console.log(state.markedPiece?.type === piece, 'mkdP')
                console.log(isActive, 'isactive')
                this.classList.toggle('active', isActive)  // 如果有标记的棋子，设置背景色为红色
            };
            // btn.style.backgroundColor = colorClass;  // 设置背景色
            // 绑定点击事件
            btn.addEventListener('click', (e) => this.onPieceBTNClick(e));
            btn.updateStyle(this);  // 初始化按钮样式
            this.pieceBTNs.push(btn);  // 将按钮添加到 pieeceBTNs 数组中
        }
    }
    getPieceBTN(pieceType: PieceType): IPieceBTN | undefined {
        return this.pieceBTNs.find(btn => btn.id === `piece-${pieceType}`);
    }
    onPieceBTNClick(e: MouseEvent) {
        if (this.markedPiece?.hidden) {
            const btn = this.getPieceBTN(this.markedPiece.type);
            btn!.pieces.push(this.markedPiece); // 将标记的棋子添加到对应按钮中
            this.markedPiece = null; // 取消标记
        }
        const btn = e.currentTarget as IPieceBTN;
        if (btn.pieces.length > 0) {
            // 如果已经有标记的棋子，先取消标记
            this.markedPiece = btn.pieces.pop() || null;
        }
        // 关键：所有按钮都刷新样式
        this.pieceBTNs.forEach(b => b.updateStyle?.(this));
    }
}