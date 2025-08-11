import { tokenize, type Token, type TokenType } from './Tokenizer';
import type { ChessNode, IBoard, IMove, IPosition } from '../../types';
import { loadBoardFromFEN } from '../../utils/parse';
import { DEFAULT_FEN } from '../../types';

export class PGNParser {
    tokens: Token[];
    nodeMap: Map<string, ChessNode>;
    currentIndex: number;
    rootNode: ChessNode;
    currentNode: ChessNode;
    nodeId: number;
    currentStep: number = 0;
    currentSide: 'red' | 'black' = 'red';
    tags: Map<string, string> = new Map();

    constructor(input: string | Token[]) {
        this.nodeMap = new Map<string, ChessNode>();
        this.tokens = typeof input === 'string' ? tokenize(input) : input;
        this.currentIndex = 0;
        this.nodeId = 1;

        // 先创建rootNode
        this.rootNode = {
            id: `node-root`,
            data: null,
            step: 0,
            side: null,
            parentID: null,
            children: [],
            mainID: null,
            board: loadBoardFromFEN(DEFAULT_FEN).board,
            comments: []
        };
        this.nodeMap.set(this.rootNode.id, this.rootNode);
        this.currentStep++;

        // 然后设置currentNode
        this.currentNode = this.rootNode;

        while (!this.match('eof')) {
            if (this.match('tag')) {
                this.parseTag(); // 跳过标签
            } else if (this.match('iccs-move')) {
                this.processMove(this.parseICCS(this.consume().value));
            } else if (this.match('wxf-move')) {
                this.processMove(this.parseWXF(this.consume().value));
            } else if (this.match('left-paren')) {
                this.parseVariation();
            } else if (this.match('comment')) {
                this.parseComment();
            } else {
                this.consume(); // 跳过无法识别的token
            }
        }
    }

    parseTag() {
        const token = this.consume(); // 取出 tag 类型的 token
        const tagText = token.value;

        const match = tagText.match(/^\[(\w+)\s+"([^"]*)"\]$/);
        if (!match) return;

        const [, tagName, tagValue] = match;

        this.tags.set(tagName, tagValue); // 全部收集

        if (tagName.toUpperCase() === 'FEN') {
            // 可选：你可以在这里初始化棋盘
            const { board, turn } = loadBoardFromFEN(tagValue);
            this.currentNode.board = board; // 设置当前节点的棋盘状态
            this.currentSide = turn === 'b' ? 'black' : 'red'; // 设置当前方
        }
    }


    createNode(move: IMove | null): ChessNode {
        const node: ChessNode = {
            id: `node-${this.nodeId++}`,
            data: move,
            step: this.currentStep,
            side: this.currentSide,
            parentID: this.currentNode.id,
            children: [],
            mainID: null,
            comments: []
        };
        this.nodeMap.set(node.id, node);
        return node;
    }

    peek(): Token {
        return this.tokens[this.currentIndex];
    }

    consume(): Token {
        return this.tokens[this.currentIndex++];
    }

    match(type: TokenType): boolean {
        return this.peek().type === type;
    }

    parseICCS(ICCS: string): IMove {
        // 解析 PGN 字符串为 IMove 数组
        // 解析走法，例如 "H2-D2" -> 起点和终点
        const [fromSting, toSting] = ICCS.split("-");
        const fromX = fromSting.charCodeAt(0) - "A".charCodeAt(0);
        const fromY = 9 - parseInt(fromSting[1]); // 修正 Y 坐标，从下往上数
        const toX = toSting.charCodeAt(0) - "A".charCodeAt(0);
        const toY = 9 - parseInt(toSting[1]); // 修正 Y 坐标，从下往上数
        const from = { x: fromX, y: fromY };
        const to = { x: toX, y: toY };
        return { from, to, ICCS };
    }

    parseWXF(wxf: string): IMove {
        // 简化的中文着法解析，实际需要更复杂的处理
        // 这里只是一个示例，实际实现需要完整的中文着法解析逻辑
        return {
            WXF: wxf,
            from: { x: 0, y: 0 }, // 需要实际计算
            to: { x: 0, y: 0 }    // 需要实际计算
        };
    }

    processMove(move: IMove) {
        const newNode = this.createNode(move);
        newNode.data!.type = this.currentNode.board![move.from.x][move.from.y] ?? undefined;
        newNode.board = this.moveBoard(move);
        this.nodeMap.set(newNode.id, newNode);
        this.currentNode.children.push(newNode);
        this.currentNode = newNode;
        this.switchSide();
        this.currentStep++;
    }

    moveBoard(move: IMove): IBoard {
        const newboard = this.currentNode.board!.map(row => row.slice());
        const from = move.from;
        const to = move.to;
        const piece = newboard[from.x][from.y];
        newboard[from.x][from.y] = null; // 清除原位置
        if (newboard[to.x][to.y]) {
            move.captured = newboard[to.x][to.y]; // 记录被吃掉的棋子
        }
        newboard[to.x][to.y] = piece; // 设置新位置
        return newboard;
    }

    parseVariation() {
        this.consume(); // 消费 '('

        // --- 判断变着应该挂在哪个节点上 ---
        const variationBase = this.nodeMap.get(this.currentNode.parentID!);
        const prevState = {
            node: this.currentNode,
            step: this.currentStep,
            side: this.currentSide
        };

        // 从 variationBase 开始解析
        this.currentNode = variationBase!;
        this.currentStep = this.currentStep - 1;
        this.currentSide = this.currentSide === 'red' ? 'black' : 'red';

        while (!this.match('right-paren') && !this.match('eof')) {
            if (this.match('iccs-move')) {
                const move = this.parseICCS(this.consume().value);
                this.processMove(move);
            } else if (this.match('wxf-move')) {
                const move = this.parseWXF(this.consume().value);
                this.processMove(move);
            } else if (this.match('comment')) {
                this.parseComment();
            } else if (this.match('left-paren')) {
                this.parseVariation();
            } else if (this.match('result')) {
                this.consume();
                break;
            } else {
                this.consume(); // 跳过无法识别的 token
            }
        }

        if (this.match('right-paren')) {
            this.consume();
        }

        // 恢复主线解析
        this.currentNode = prevState.node;
        this.currentStep = prevState.step;
        this.currentSide = prevState.side;
    }

    parseComment() {
        const token = this.consume();
        const comment = token.value
            .replace(/^{|}$/g, '')
            .replace(/^;/, '')
            .trim();

        if (!this.currentNode.comments) {
            this.currentNode.comments = [];
        }
        this.currentNode.comments.push(comment);
    }

    switchSide() {
        this.currentSide = this.currentSide === 'red' ? 'black' : 'red';
    }

    public getTags(): string {
        const lines: string[] = [];
        for (const [key, value] of this.tags.entries()) {
            lines.push(`[${key} "${value}"]`);
        }
        return lines.join('\n');
    }
    public getRoot(): ChessNode {
        return this.rootNode;
    }
    public getMap(): Map<string, ChessNode> {
        return this.nodeMap;
    }
}