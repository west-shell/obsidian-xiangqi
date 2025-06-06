import XiangqiPlugin from "./main";
import { MarkdownRenderChild } from "obsidian";
import { ISettings, IPiece, IMove } from './types';
import { parseSource } from './parseSource';
import { generateBoardSvg, createPieceSvg, createButtonSvg } from './svg';
import { isValidMove } from './rules';

export class chessRenderChild extends MarkdownRenderChild {
    // 修改为更具描述性的变量名
    private cellSize: number; // 每个格子的大小
    private moves: string[] = [];
    private boardContainer: HTMLDivElement | null = null;
    private toolbarContainer: HTMLDivElement | null = null;
    private board: (string | null)[][] = [];
    private boardClickBound = false;
    private pieces: IPiece[] = [];
    private hidenPieces: IPiece[] = [];
    private markedPiece: IPiece | null = null;
    private history: IMove[] = [];
    private undoHistory: IMove[] = [];
    private currentTurn: 'red' | 'black' = 'red'; // 新增，默认红方先手
    private currentStep: number = 0;
    private modified: boolean = false;

    constructor(
        private plugin: XiangqiPlugin,
        private settings: ISettings,
        containerEl: HTMLElement,
        private source: string
    ) {
        super(containerEl);
        this.cellSize = settings.cellSize; // 从设置中获取 cellSize
    }

    // 主函数
    onload() {
        this.plugin.renderChildren.add(this);
        this.parseSource();
        this.rend();
        this.bindEvents();
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
            const gNode = createPieceSvg(piece, this.settings);
            piecesContainer.appendChild(gNode!);
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
    }
    private bindEvents() {
        // 只绑定一次棋盘点击事件
        if (this.boardContainer && !this.boardClickBound) {
            this.boardContainer.addEventListener('click', this.handleBoardClick);
            this.boardClickBound = true;
        }
        const resetButton = this.toolbarContainer!.querySelector('#reset');
        if (resetButton) resetButton.addEventListener('click', this.handleResetClick);
        const undoButton = this.toolbarContainer!.querySelector('#undo');
        if (undoButton) {
            undoButton.addEventListener('click', () => {
                this.undoMove(); // 撤销上一步 
            })
        }
        const redoButton = this.toolbarContainer!.querySelector('#redo');
        if (redoButton) {
            redoButton.addEventListener('click', () => {
                this.redoMove();
            });
        }
    }

    // 解析相关私有方法
    private parseSource() {
        const { board, moves, pieces, firstTurn } = parseSource(this.source);
        this.pieces = pieces;
        this.board = board;
        this.moves = moves;
        this.currentTurn = firstTurn;
    }

    private handleBoardClick = (e: MouseEvent) => {
        if (!this.boardContainer) return;
        const boardRect = this.boardContainer.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left;
        const mouseY = e.clientY - boardRect.top;
        const gridX = Math.round(mouseX / this.cellSize) - 1;
        const gridY = Math.round(mouseY / this.cellSize) - 1;
        const clickedPiece = this.findPieceAt(gridX, gridY);

        if (!this.markedPiece) {
            // 没有标记棋子时，只能选中当前行棋方的棋子
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if ((this.currentTurn === 'red' && clickedIsRed) || (this.currentTurn === 'black' && !clickedIsRed)) {
                    this.markPiece(clickedPiece.pieceEl!);
                    this.markedPiece = clickedPiece;
                }
            }
            return;
        }

        // 有标记棋子时，尝试走子（无论目标是空还是有棋子）
        const moveValid = isValidMove({
            from: { x: this.markedPiece.x, y: this.markedPiece.y },
            to: { x: gridX, y: gridY },
            board: this.board,
        });

        if (moveValid) {
            // 检查是否与重做历史中的下一步一致
            this.runMove(this.markedPiece.x, this.markedPiece.y, gridX, gridY);
            this.markedPiece = null; // 移动后取消标记
            this.modified = true; // 标记为已修改
        } else {
            // 不能走，取消标记
            this.restorePiece(this.markedPiece.pieceEl!);
            // 如果点击的是当前方棋子，重新标记
            if (clickedPiece) {
                const clickedIsRed = clickedPiece.type === clickedPiece.type.toUpperCase();
                if ((this.currentTurn === 'red' && clickedIsRed) || (this.currentTurn === 'black' && !clickedIsRed)) {
                    this.markPiece(clickedPiece.pieceEl!);
                    this.markedPiece = clickedPiece;
                    return;
                }
            }
            this.markedPiece = null;
        }
    };

    private runMove(fromX: number, fromY: number, toX: number, toY: number) {
        const fromPiece = this.findPieceAt(fromX, fromY);
        const toPiece = this.findPieceAt(toX, toY);
        if (!fromPiece) return;
        const nextRedoMove = this.undoHistory[this.undoHistory.length - 1];
        const currentMove = {
            fromX: fromX,
            fromY: fromY,
            toX: toX,
            toY: toY,
        };

        // 如果走的不是重做历史中的下一步，清空重做历史
        if (!nextRedoMove ||
            nextRedoMove.fromX !== currentMove.fromX ||
            nextRedoMove.fromY !== currentMove.fromY ||
            nextRedoMove.toX !== currentMove.toX ||
            nextRedoMove.toY !== currentMove.toY) {
            this.undoHistory = [];
        }

        // 记录这一步
        this.history.push({
            fromX: fromX,
            fromY: fromY,
            toX: toX,
            toY: toY,
            capture: toPiece ? toPiece : null
        });
        this.currentStep++
        // 如果目标有棋子，隐藏目标棋子
        if (toPiece) {
            toPiece.hidden = true;
            toPiece.pieceEl?.setAttribute('display', 'none');
            this.hidenPieces.push(toPiece);
        }
        // 移动棋子
        this.movePieceEL(fromPiece, toX, toY);
        this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
    }

    private handleResetClick = () => {
        while (this.history.length > 0) {
            this.undoMove(); // 撤销上一步
        }
        this.history = [];
        this.undoHistory = [];
        this.modified = false; // 重置修改状态
        this.currentStep = 0;
    }

    private undoMove() {
        if (this.history.length === 0) return;
        const lastMove = this.history.pop()!;
        // 将悔棋步骤存入悔棋历史
        this.undoHistory.push(lastMove);

        const { fromX, fromY, toX, toY, capture } = lastMove;

        // 找到需要回退的棋子
        const returnPiece = this.findPieceAt(toX, toY);
        if (!returnPiece) return;

        // 更新棋盘状态，注意坐标顺序是 [x][y]
        this.board[toX][toY] = null;
        this.board[fromX][fromY] = returnPiece.type;

        // 更新棋子位置
        returnPiece.x = fromX;
        returnPiece.y = fromY;
        returnPiece.pieceEl?.setAttribute(
            'transform',
            `translate(${(fromX + 1) * this.cellSize},${(fromY + 1) * this.cellSize})`
        );
        returnPiece.pieceEl?.setAttribute('data-x', String(fromX));
        returnPiece.pieceEl?.setAttribute('data-y', String(fromY));

        // 恢复被吃掉的棋子
        if (capture) {
            capture.hidden = false;
            capture.pieceEl?.removeAttribute('display');
            this.hidenPieces = this.hidenPieces.filter(p => p !== capture);
            this.board[toX][toY] = capture.type;
        }

        this.currentStep--;
        this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
    }
    private redoMove() {
        // 如果没有悔棋记录且没有预定义的走法，直接返回
        // 如果没有悔棋记录但有预定义的走法，从 moves 中执行下一步
        if (this.undoHistory.length === 0 && this.moves.length > 0 && !this.modified) {
            const nextMove = this.moves[this.currentStep]; // 获取并移除 moves 中的第一步
            if (!nextMove) return;

            // 解析走法，例如 "H2-D2" -> 起点和终点
            const [from, to] = nextMove.split('-');
            const fromX = from.charCodeAt(0) - 'A'.charCodeAt(0);
            const fromY = 9 - parseInt(from[1]); // 修正 Y 坐标，从下往上数
            const toX = to.charCodeAt(0) - 'A'.charCodeAt(0);
            const toY = 9 - parseInt(to[1]); // 修正 Y 坐标，从下往上数

            const movingPiece = this.findPieceAt(fromX, fromY);
            if (!movingPiece) return;

            // 如果目标位置有棋子，需要隐藏它
            const targetPiece = this.findPieceAt(toX, toY);
            if (targetPiece) {
                targetPiece.hidden = true;
                targetPiece.pieceEl?.setAttribute('display', 'none');
                this.hidenPieces.push(targetPiece);
            }

            // 移动棋子
            this.movePieceEL(movingPiece, toX, toY);

            // 记录到历史中
            this.history.push({
                fromX,
                fromY,
                toX,
                toY,
                capture: targetPiece || null,
            });

            // 切换回合
            this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
            this.currentStep++
            return;
        }

        // 如果有悔棋记录，从 undoHistory 中执行下一步
        const moveToRedo = this.undoHistory.pop();
        if (!moveToRedo) return;
        const { fromX, fromY, toX, toY, capture } = moveToRedo;

        // 找到要移动的棋子
        const movingPiece = this.findPieceAt(fromX, fromY);
        if (!movingPiece) return;

        // 如果目标位置有棋子，需要隐藏它
        if (capture) {
            capture.hidden = true;
            capture.pieceEl?.setAttribute('display', 'none');
            this.hidenPieces.push(capture);
        }

        // 移动棋子
        this.movePieceEL(movingPiece, toX, toY);

        // 记录到历史中
        this.history.push(moveToRedo);

        // 切换回合
        this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
        this.currentStep++;
    }
    refresh() {
        // 刷新棋盘和棋子
        this.settings = this.plugin.settings; // 确保 settings 是最新的
        this.cellSize=this.plugin.settings.cellSize; // 确保 cellSize 是最新的
        this.rend();
        this.bindEvents();
    }
    // 卸载相关方法
    onunload() {
        this.plugin.renderChildren.delete(this);
    }
    private markPiece(pieceEl: Element) {
        if (!pieceEl.hasAttribute('data-original-transform')) {
            const originalTransform = pieceEl.getAttribute('transform') || '';
            const cleanTransform = originalTransform.replace(/\s*scale\([^)]+\)/, '');
            pieceEl.setAttribute('data-original-transform', cleanTransform);
            pieceEl.setAttribute('transform', `${cleanTransform} scale(1.2)`);
        }
    }

    private restorePiece(pieceEl: Element) {
        const originalTransform = pieceEl.getAttribute('data-original-transform');
        if (originalTransform !== null) {
            pieceEl.setAttribute('transform', originalTransform);
            pieceEl.removeAttribute('data-original-transform');
        }
    }

    private findPieceAt(x: number, y: number): IPiece | undefined {
        return this.pieces.find(p => p.x === x && p.y === y && !p.hidden);
    }
    private movePieceEL(movingPiece: IPiece, toX: number, toY: number) {
        const fromX = movingPiece.x;
        const fromY = movingPiece.y;
        this.board[fromX][fromY] = null;
        this.board[toX][toY] = movingPiece.type;
        this.restorePiece(movingPiece.pieceEl!);
        movingPiece.x = toX;
        movingPiece.y = toY;
        movingPiece.pieceEl!.setAttribute('transform', `translate(${(toX + 1) * this.cellSize},${(toY + 1) * this.cellSize})`);
        movingPiece.pieceEl!.setAttribute('data-x', String(toX));
        movingPiece.pieceEl!.setAttribute('data-y', String(toY));
    }
}