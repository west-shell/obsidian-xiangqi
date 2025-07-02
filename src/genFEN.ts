import XQPlugin from './main';
import { XQRenderChild } from './xiangqi';
import { MarkdownPostProcessorContext, MarkdownView, Notice, setIcon } from 'obsidian';
import { themes, updateRectStroke } from './svg';
import { IBoard, IPiece, ITurn, PIECE_CHARS, PieceType } from './types';
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
        this.plugin.renderChildren.add(this)
        this.parseSource();
        this.rend();
        this.creatButtons();
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
        const clickedPos = this.getClickedPos(e);
        if (!clickedPos) return;
        if (clickedPos.x > 8 || clickedPos.y > 9) return
        const clickedPiece = findPieceAt(clickedPos, this);

        // 1. 无选中则选中
        if (!this.markedPiece) {
            if (clickedPiece) {
                markPiece(clickedPiece.pieceEl!);
                this.markedPiece = clickedPiece;
            }
            return;
        }

        // 2. 选中了按钮（从按钮拖回棋盘）
        if (this.markedPiece.hidden) {
            const markedBTN = this.getPieceBTN(this.markedPiece.type);
            // 目标格如有棋子，先吃掉
            if (clickedPiece) {
                clickedPiece.hidden = true;
                clickedPiece.pieceEl?.setAttribute('display', 'none');
                this.board[clickedPiece.position.x][clickedPiece.position.y] = null;
                const btn = this.getPieceBTN(clickedPiece.type);
                btn?.pieces.push(clickedPiece);
                btn?.updateStyle?.(this);
            }
            this.markedPiece.hidden = false;
            this.markedPiece.pieceEl!.removeAttribute('display');
            movePiece(this.markedPiece, null, clickedPos, this);
            this.markedPiece = null;
            markedBTN?.updateStyle?.(this);
            this.pieceBTNs.forEach(b => b.updateStyle?.(this));
            return;
        }

        // 3. 再次点击同一棋子，吃回按钮
        if (this.markedPiece === clickedPiece) {
            restorePiece(this.markedPiece.pieceEl!);
            this.markedPiece.hidden = true;
            this.markedPiece.pieceEl!.setAttribute('display', 'none');
            if (this.markedPiece.position) {
                this.board[this.markedPiece.position.x][this.markedPiece.position.y] = null;
            }
            const btn = this.getPieceBTN(this.markedPiece.type);
            btn?.pieces.push(this.markedPiece);
            this.markedPiece = null;
            btn?.updateStyle?.(this);
            this.pieceBTNs.forEach(b => b.updateStyle?.(this));
            return;
        }

        // 4. 移动棋子
        restorePiece(this.markedPiece.pieceEl!);
        // 目标有棋子，先吃掉
        if (clickedPiece) {
            clickedPiece.hidden = true;
            clickedPiece.pieceEl?.setAttribute('display', 'none');
            this.board[clickedPiece.position.x][clickedPiece.position.y] = null;
            const btn = this.getPieceBTN(clickedPiece.type);
            btn?.pieces.push(clickedPiece);
            btn?.updateStyle?.(this);
        }
        if (this.markedPiece.position) {
            movePiece(this.markedPiece, this.markedPiece.position, clickedPos, this);
        } else {
            movePiece(this.markedPiece, null, clickedPos, this);
        }
        this.markedPiece = null;
        this.pieceBTNs.forEach(b => b.updateStyle?.(this));
    };


    creatButtons() {
        // 创建工具栏容器
        const pieceBTNContainer = this.containerEl.createEl('div', {
            cls: 'pieceBTN-container',
        });
        pieceBTNContainer.classList.toggle('right', this.settings.position === 'right');
        pieceBTNContainer.classList.toggle('bottom', this.settings.position === 'bottom');
        // 遍历 PIECE_CHARS 中的每一个棋子，去掉 'K' 和 'k' 代表的将
        for (const piece in PIECE_CHARS) {
            const title = PIECE_CHARS[piece as PieceType]; // 获取棋子的名称
            const isRed = piece === piece.toUpperCase();
            // 判断是红方（大写字母）还是黑方（小写字母），并设置不同的类名
            const colorClass = isRed ? 'red' : 'blue';
            const className = `piece-btn ${colorClass}-piece`; // 动态类名

            // 创建按钮并设置 id、title、class 等
            const btn = pieceBTNContainer.createEl('button', {
                text: title, // 按钮文本
                attr: { id: `piece-${piece}` }, // 设置 id 方便识别点击对象
                cls: className,
            }) as IPieceBTN;
            if (this.settings.position === 'right') {
                btn.style.height = `${0.76 * this.settings.cellSize}px`
            } if (this.settings.position === 'bottom') {
                btn.style.height = ''
            }
            btn.pieces = []; // 初始化 pieces 数组，用于存储被吃掉的棋子
            const { red, blue } = themes[this.settings.theme];
            btn.style.backgroundColor = isRed ? red : blue;
            btn.updateStyle = function (state: XQRenderChild) {
                this.classList.toggle('empty', this.pieces.length === 0);
                const isActive =
                    (state.markedPiece?.hidden ?? false) && state.markedPiece?.type === piece;
                this.classList.toggle('active', isActive); // 如果有标记的棋子，设置背景色为红色
            };
            // btn.style.backgroundColor = colorClass;  // 设置背景色
            // 绑定点击事件
            btn.addEventListener('click', (e) => this.onPieceBTNClick(e));
            btn.updateStyle(this); // 初始化按钮样式
            this.pieceBTNs.push(btn); // 将按钮添加到 pieeceBTNs 数组中
        }
        // 按钮定义，isave 标识保存按钮
        const buttons = [
            { title: '清空', text: '空', handler: () => this.onEmptyBTNClick(this) },
            { title: '填满', text: '满', handler: () => this.onResetBTNClick(this) },
            { title: '保存', text: '存', handler: () => this.onSaveBTNClick(this) },
            { title: '先手', text: '先', handler: (e: MouseEvent) => this.onTurnBTNClick(e, this), color: true },
        ];
        const position = this.settings.position
        const toolbarContainer = this.containerEl.createEl('div', {
            cls: `getFENT-toolbar-container ${position}`,
        });
        for (const { title, text, handler, color } of buttons) {
            const btn = toolbarContainer.createEl('button', {
                text,
                attr: { title },
                cls: 'toolbar-btn',
            });
            if (color) {
                btn.textContent = text;
                const { red, blue } = themes[this.settings.theme]
                btn.style.backgroundColor = this.currentTurn === 'red' ? red : blue;
            }
            btn.addEventListener('click', handler);
        }
    }
    getPieceBTN(pieceType: PieceType): IPieceBTN | undefined {
        return this.pieceBTNs.find((btn) => btn.id === `piece-${pieceType}`);
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
        this.pieceBTNs.forEach((b) => b.updateStyle?.(this));
    }
    onEmptyBTNClick(state: GenFENRenderChild) {
        state.pieces.forEach((piece) => {
            if (piece.hidden) return;
            piece.hidden = true;
            piece.pieceEl?.setAttribute('display', 'none');
            const btn = state.getPieceBTN(piece.type) as IPieceBTN;
            if (!btn) return;
            btn.pieces.push(piece);
            btn.updateStyle?.(this);
        });
        ['k', 'K'].forEach((key) => {
            const btn = state.getPieceBTN(key as PieceType) as IPieceBTN
            const piece = btn.pieces.pop()
            if (!piece) return
            piece.hidden = false
            piece.pieceEl?.removeAttribute('display')

            const position = key === key.toUpperCase() ? { x: 4, y: 9 } : { x: 4, y: 0 }
            movePiece(piece, null, position, this)
            btn!.updateStyle!(this)
        })

    }
    onResetBTNClick(state: GenFENRenderChild) {
        state.refresh()
    }

    async onSaveBTNClick(state: GenFENRenderChild) {
        // 1. 生成 FEN
        const fen = this.genFENFromBoard(this.board, this.currentTurn);
        console.log(fen, 'fen')
        // 2. 获取当前 markdown 编辑器视图和文件
        const view = state.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const file = view.file;
        if (!file) return;

        // 3. 获取当前代码块的 section 信息
        const section = state.ctx.getSectionInfo(state.containerEl);
        if (!section) return;
        const { lineStart, lineEnd } = section;

        // 4. 读取文件内容并分行
        const content = await state.plugin.app.vault.read(file);
        const lines = content.split('\n');

        // 5. 获取代码块内容行
        let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);
        if (blockLines.length < 2) return;

        // 6. 判断并替换代码块类型为 xiangqi，内容为 FEN
        // 只替换代码块首尾行，内容只保留 FEN
        blockLines[0] = blockLines[0].replace(/^```xq\b.*$/, '```xiangqi');
        blockLines = [blockLines[0], `[FEN "${fen}"]`, '```'];

        // 7. 拼接新内容并写回
        const newContent = [
            ...lines.slice(0, lineStart),
            ...blockLines,
            ...lines.slice(lineEnd + 1),
        ].join('\n');

        await state.plugin.app.vault.modify(file, newContent);
        new Notice('FEN已保存到代码块');

    }
    onTurnBTNClick(e: MouseEvent, state: GenFENRenderChild) {
        const btn = e.target as HTMLButtonElement
        this.currentTurn = state.currentTurn === 'red' ? 'blue' : 'red'
        const { red, blue } = themes[state.settings.theme]
        const color = state.currentTurn === 'red' ? red : blue
        btn.style.backgroundColor = color
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.style.backgroundColor = color; // 有些主题需要
            // svg.style.fill = '#fff'; // 或你想要的图标颜色
        }
        updateRectStroke(state)
    }

    genFENFromBoard(board: IBoard, turn: ITurn): string {
        // board[x][y]，x为列，y为行
        const rows: string[] = [];
        for (let y = 0; y < 10; y++) {
            let fenRow = '';
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
        const fen = rows.join('/');
        return `${fen} ${turn === 'red' ? 'w' : 'b'}`
    }
    refresh() {
        this.pieces = [];
        this.pieceBTNs = [];
        this.parseSource();
        this.rend();
        this.creatButtons();
    }
}
