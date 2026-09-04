import { Chess, type Move } from "../../chess";
import {
  DEFAULT_FEN,
  EVAL_REGEX,
  isMoveCheckmate,
  type MoveTokenType,
  parseMoveInGame,
  PRIMARY_MOVE_TOKEN_TYPES,
  SHAPE_PART_REGEX,
} from "../../chess";
import { type ChessNode, type NodeShape } from "../../types";
import {
  ANNOTATION_PREFIX,
  isAnnotationKey,
  SHAPES_PREFIX,
} from "../../utils/icon";
import { GLYPH_DEFS } from "../../utils/winningChances";

import { type Token, tokenize, type TokenType } from "./Tokenizer";

export class PGNParser {
  haveFEN: boolean = false;
  tokens: Token[];
  nodeMap: Map<string, ChessNode>;
  currentIndex: number;
  rootNode: ChessNode;
  currentNode: ChessNode;
  nodeId: number;
  currentStep: number = 0;
  tags: Map<string, string> = new Map();
  chess: Chess;

  constructor(input: string | Token[]) {
    this.nodeMap = new Map<string, ChessNode>();
    this.tokens = typeof input === "string" ? tokenize(input) : input;
    this.currentIndex = 0;
    this.nodeId = 1;

    this.chess = new Chess(DEFAULT_FEN);

    this.rootNode = {
      id: `node-root`,
      fen: DEFAULT_FEN,
      move: null,
      step: 0,
      color: null,
      parentID: null,
      children: [],
      comments: [],
    };
    this.nodeMap.set(this.rootNode.id, this.rootNode);
    this.currentStep++;

    this.currentNode = this.rootNode;

    while (!this.match("eof")) {
      if (this.match("tag")) {
        this.parseTag();
      } else if (this.isMoveToken()) {
        this.processMove(
          this.consume().value,
          this.tokens[this.currentIndex - 1].type as MoveTokenType,
        );
      } else if (this.match("left-paren")) {
        this.parseVariation();
      } else if (this.match("comment")) {
        this.parseComment();
      } else if (this.match("result")) {
        this.parseResult();
      } else {
        this.consume();
      }
    }
  }

  isMoveToken(): boolean {
    const type = this.peek().type;
    return (PRIMARY_MOVE_TOKEN_TYPES as readonly string[]).includes(type);
  }

  parseTag() {
    const token = this.consume();
    const tagText = token.value;

    const match = tagText.match(/^\[(\w+)\s+"([^"]*)"\]$/);
    if (!match) return;

    const [, tagName, tagValue] = match;
    this.tags.set(tagName, tagValue);

    if (tagName.toUpperCase() === "FEN") {
      try {
        this.chess.load(tagValue);
        this.rootNode.fen = tagValue;
        this.haveFEN = true;
      } catch {
        // invalid FEN, keep default
      }
    }
  }

  createNode(move: Move, fen: string): ChessNode {
    const color = move.color === "w" ? "white" : "black";
    const node: ChessNode = {
      id: `node-${this.nodeId++}`,
      fen,
      move,
      step: this.currentStep,
      color,
      parentID: this.currentNode.id,
      children: [],
      comments: [],
      isCheckmate: isMoveCheckmate(move),
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

  processMove(token: string, tokenType: MoveTokenType) {
    const fen = this.currentNode.fen;
    this.chess.load(fen);
    try {
      const move = parseMoveInGame(this.chess, token, tokenType);
      if (!move) return;

      const newNode = this.createNode(move, this.chess.fen());
      this.currentNode.children.push(newNode);
      this.currentNode = newNode;
      this.currentStep++;
    } catch {
      // invalid move, skip
    }
  }

  parseVariation() {
    this.consume();

    const variationParentID = this.currentNode.parentID;
    if (!variationParentID) {
      while (!this.match("right-paren") && !this.match("eof")) {
        this.consume();
      }
      if (this.match("right-paren")) this.consume();
      return;
    }
    const variationBase = this.nodeMap.get(variationParentID)!;
    const prevState = {
      node: this.currentNode,
      step: this.currentStep,
    };

    this.currentNode = variationBase;
    this.currentStep = variationBase.step!;

    while (!this.match("right-paren") && !this.match("eof")) {
      if (this.isMoveToken()) {
        this.processMove(
          this.consume().value,
          this.tokens[this.currentIndex - 1].type as MoveTokenType,
        );
      } else if (this.match("comment")) {
        this.parseComment();
      } else if (this.match("left-paren")) {
        this.parseVariation();
      } else if (this.match("result")) {
        const token = this.consume();
        const validResults = ["1-0", "0-1", "1/2-1/2"];
        if (validResults.includes(token.value)) {
          this.currentNode.result = token.value;
        }
        break;
      } else {
        this.consume();
      }
    }

    if (this.match("right-paren")) {
      this.consume();
    }

    this.currentNode = prevState.node;
    this.currentStep = prevState.step;
  }

  parseComment() {
    const token = this.consume();
    const raw = token.value.replace(/^{|}$/g, "").replace(/^;/, "").trim();

    const evalMatch = raw.match(EVAL_REGEX);
    if (evalMatch) {
      const evalStr = evalMatch[1];
      const bestmove = evalMatch[2] || undefined;
      const ponder = evalMatch[3] || undefined;
      const glyphSymbol = evalMatch[4] || undefined;
      let scoreType: "cp" | "mate" = "cp";
      let score: number;
      if (evalStr.startsWith("m")) {
        scoreType = "mate";
        const mateStr = evalStr.slice(1);
        const isNeg = mateStr.startsWith("-");
        const mateVal = Number.parseInt(mateStr.replace(/[^0-9]/g, ""));
        score = isNeg ? -mateVal : mateVal;
      } else {
        score = Math.round(Number.parseFloat(evalStr) * 100);
      }
      this.currentNode.eval = { score, scoreType, depth: 0, bestmove, ponder };
      if (glyphSymbol) {
        const glyphDef = GLYPH_DEFS[glyphSymbol];
        if (glyphDef) this.currentNode.glyph = glyphDef;
      }
      return;
    }

    if (raw.startsWith(ANNOTATION_PREFIX)) {
      const key = raw.slice(ANNOTATION_PREFIX.length);
      if (isAnnotationKey(key)) {
        this.currentNode.annotation = key;
        return;
      }
    }

    if (raw.startsWith(SHAPES_PREFIX)) {
      const shapesStr = raw.slice(SHAPES_PREFIX.length);
      const shapes: NodeShape[] = [];
      for (const part of shapesStr.split(",")) {
        const m = part.match(SHAPE_PART_REGEX);
        if (m) shapes.push({ orig: m[1], dest: m[2], brush: m[3] });
      }
      if (shapes.length > 0) {
        this.currentNode.shapes = shapes;
        return;
      }
    }

    this.currentNode.comments ??= [];
    this.currentNode.comments.push(raw);
  }

  parseResult() {
    const token = this.consume();
    const validResults = ["1-0", "0-1", "1/2-1/2", "*"];
    if (validResults.includes(token.value)) {
      if (token.value !== "*") {
        this.currentNode.result = token.value;
      }
      this.tags.set("Result", token.value);
    }
  }

  public getTags(): string {
    const lines: string[] = [];
    for (const [key, value] of this.tags.entries()) {
      lines.push(`[${key} "${value}"]`);
    }
    return lines.join("\n");
  }
  public getRoot(): ChessNode {
    return this.rootNode;
  }
  public getMap(): Map<string, ChessNode> {
    return this.nodeMap;
  }
  public getMainLine(): ChessNode[] {
    const mainLine: ChessNode[] = [];
    let current = this.rootNode;
    while (current.children.length > 0) {
      const mainChild = current.children[0];
      mainLine.push(mainChild);
      current = mainChild;
    }
    return mainLine;
  }
}
