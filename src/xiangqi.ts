import { MarkdownRenderChild } from 'obsidian';
import { ISettings } from './settings';
import { generateBoardSvg, createPieceSvg, createButtonSvg } from './svg';
import { isValidMove } from './rules';


// 定义 Piece 类型，添加 pieceEl 属性
type Piece = {
    type: string;
    x: number;
    y: number;
    pieceEl?: SVGGElement;
    hidden?: boolean;
};

export class BoardRender extends MarkdownRenderChild {
    // 修改为更具描述性的变量名
    private settings: ISettings;
    private cellSize: number = 50; // 每个格子的大小
    private fen: string = '';
    private boardContainer: HTMLDivElement | null = null;
    private toolbarContainer: HTMLDivElement | null = null;
    private board: (string | null)[][] = [];
    private boardClickBound = false;
    private pieces: Piece[] = [];
    private hidenPieces: Piece[] = [];
    private markedPiece: Piece | null = null;
    private history: Array<{
        fromX: number, fromY: number,
        toX: number, toY: number,
        capture: Piece | null,
        Step: number
    }> = [];
    private undoHistory: Array<{
        fromX: number, fromY: number,
        toX: number, toY: number,
        capture: Piece | null,
        Step: number
    }> = [];
    private currentTurn: 'red' | 'black' = 'red'; // 新增，默认红方先手
    private currentStep: number = 0;

    constructor(
        settings: ISettings,
        containerEl: HTMLElement,
        private source: string
    ) {
        super(containerEl);
        this.settings = settings;
        this.cellSize = settings.cellSize; // 从设置中获取 cellSize
    }

    // 主函数
    main() {
        this.parseSource();
        this.rend();
        this.bindEvents();
    }
    private rend() {
        this.containerEl.empty();
        this.boardContainer = this.containerEl.createDiv({ cls: 'xiangqi-container' });
        // 插入棋盘棋子控件 SVG
        this.boardContainer.insertAdjacentHTML('afterbegin', generateBoardSvg(this.settings));
        const piecesContainer = this.boardContainer.querySelector('#xiangqi-pieces');
        if (piecesContainer) {
            piecesContainer.innerHTML = '';
            this.pieces.forEach((piece, index) => {
                const pieceHtml = createPieceSvg(piece.type, piece.x, piece.y, this.settings);
                piecesContainer.insertAdjacentHTML('beforeend', pieceHtml);
                const pieceEl = piecesContainer.lastElementChild as SVGGElement;
                if (pieceEl) {
                    this.pieces[index].pieceEl = pieceEl;
                }
            });
        }
        const toolbar = this.boardContainer.querySelector('#toolbar');
        this.toolbarContainer = toolbar as HTMLDivElement;
        if (toolbar) {
            toolbar.innerHTML = '';
            const buttonHtml = createButtonSvg(this.settings);
            toolbar.insertAdjacentHTML('beforeend', buttonHtml);
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
        const board: (string | null)[][] = Array.from({ length: 10 }, () => Array(9).fill(null));
        const pieces: { type: string; x: number; y: number }[] = [];
        const [position, turn] = this.source.trim().split(/\s+/);
        if (!position) return { board, pieces };

        const rows = position.split('/');
        if (rows.length !== 10) return { board, pieces };

        rows.forEach((row, y) => {
            let x = 0;
            for (const char of row) {
                if (/[1-9]/.test(char)) {
                    x += parseInt(char);
                } else if (/[a-zA-Z]/.test(char)) {
                    board[x][y] = char;
                    pieces.push({ type: char, x, y });
                    x++;
                }
            }
        });

        this.board = board;
        this.pieces = pieces;
        // 根据 FEN 初始化 currentTurn
        this.currentTurn = turn === 'b' ? 'black' : 'red';
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
            const nextRedoMove = this.undoHistory[this.undoHistory.length - 1];
            const currentMove = {
                fromX: this.markedPiece.x,
                fromY: this.markedPiece.y,
                toX: gridX,
                toY: gridY
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
                fromX: this.markedPiece.x,
                fromY: this.markedPiece.y,
                toX: gridX,
                toY: gridY,
                capture: clickedPiece ? clickedPiece : null,
                Step: this.currentStep++
            });
            // 如果目标有棋子，隐藏目标棋子
            if (clickedPiece) {
                clickedPiece.hidden = true;
                clickedPiece.pieceEl?.setAttribute('display', 'none');
                this.hidenPieces.push(clickedPiece);
            }
            // 移动棋子
            this.movePiece(this.markedPiece, gridX, gridY);
            this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
            this.markedPiece = null; // 移动后取消标记

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
    private handleResetClick = () => {
        while (this.history.length > 0) {
            this.undoMove(); // 撤销上一步
        }
    }
    private markPiece(pieceEl: SVGGElement) {
        if (!pieceEl.hasAttribute('data-original-transform')) {
            const originalTransform = pieceEl.getAttribute('transform') || '';
            const cleanTransform = originalTransform.replace(/\s*scale\([^)]+\)/, '');
            pieceEl.setAttribute('data-original-transform', cleanTransform);
            pieceEl.setAttribute('transform', `${cleanTransform} scale(1.2)`);
        }
    }

    private restorePiece(pieceEl: SVGGElement) {
        const originalTransform = pieceEl.getAttribute('data-original-transform');
        if (originalTransform !== null) {
            pieceEl.setAttribute('transform', originalTransform);
            pieceEl.removeAttribute('data-original-transform');
        }
    }

    private findPieceAt(x: number, y: number): Piece | undefined {
        return this.pieces.find(p => p.x === x && p.y === y && !p.hidden);
    }
    private movePiece(movingPiece: Piece, toX: number, toY: number) {
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
    private undoMove() {
        if (this.history.length === 0) return;
        const lastMove = this.history.pop()!;
        // 将悔棋步骤存入悔棋历史
        this.undoHistory.push(lastMove);

        const { fromX, fromY, toX, toY, capture, Step } = lastMove;

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
        if (this.undoHistory.length === 0) return;

        const moveToRedo = this.undoHistory.pop()!;
        const { fromX, fromY, toX, toY, capture } = moveToRedo;

        // 找到要移动的棋子
        const movingPiece = this.findPieceAt(fromX, fromY);
        if (!movingPiece) return;

        // 如果目标位置有棋子,需要隐藏它
        if (capture) {
            capture.hidden = true;
            capture.pieceEl?.setAttribute('display', 'none');
            this.hidenPieces.push(capture);
        }

        // 移动棋子
        this.movePiece(movingPiece, toX, toY);

        // 记录到历史中
        this.history.push(moveToRedo);

        // 切换回合
        this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
        this.currentStep++;
    }
    // 卸载相关方法
    onunload() {
        // 清理棋盘事件
        if (this.boardContainer && this.boardClickBound) {
            this.boardContainer.removeEventListener('click', this.handleBoardClick);
            this.boardClickBound = false;
        }

        // 移除按钮事件监听器
        const resetButton = this.toolbarContainer?.querySelector('#reset');
        const undoButton = this.toolbarContainer?.querySelector('#undo');
        const redoButton = this.toolbarContainer?.querySelector('#redo');

        if (resetButton) resetButton.remove();
        if (undoButton) undoButton.remove();
        if (redoButton) redoButton.remove();

        // 确保卸载时重置当前标记的棋子
        this.markedPiece = null;
    }
}