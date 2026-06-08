import { Chess, type Move } from '@west-shell/xiangqi.js';

import type { ChessNode } from '../../types';
import { DEFAULT_FEN } from '../../types';

import { tokenize, type Token, type TokenType } from './Tokenizer';

export class PGNParser {
  haveFEN: boolean = false;
  tokens: Token[];
  nodeMap: Map<string, ChessNode>;
  currentIndex: number;
  rootNode: ChessNode;
  currentNode: ChessNode;
  nodeId: number;
  currentStep: number = 0;
  currentSide: string | null = null;
  tags: Map<string, string> = new Map();
  chess: Chess;

  constructor(input: string | Token[]) {
    this.nodeMap = new Map<string, ChessNode>();
    this.tokens = typeof input === 'string' ? tokenize(input) : input;
    this.currentIndex = 0;
    this.nodeId = 1;

    this.chess = new Chess(DEFAULT_FEN);

    this.rootNode = {
      id: `node-root`,
      fen: DEFAULT_FEN,
      move: null,
      step: 0,
      side: null,
      parentID: null,
      children: [],
      mainID: null,
      comments: [],
    };
    this.nodeMap.set(this.rootNode.id, this.rootNode);
    this.currentStep++;

    this.currentNode = this.rootNode;
    this.currentSide = null;

    while (!this.match('eof')) {
      if (this.match('tag')) {
        this.parseTag();
      } else if (this.match('iccs-move')) {
        this.processSAN(this.consume().value);
      } else if (this.match('wxf-move')) {
        this.consume(); // skip WXF for now
      } else if (this.match('left-paren')) {
        this.parseVariation();
      } else if (this.match('comment')) {
        this.parseComment();
      } else if (this.match('result')) {
        this.parseResult();
      } else {
        this.consume();
      }
    }
  }

  parseTag() {
    const token = this.consume();
    const tagText = token.value;

    const match = tagText.match(/^\[(\w+)\s+"([^"]*)"\]$/);
    if (!match) return;

    const [, tagName, tagValue] = match;
    this.tags.set(tagName, tagValue);

    if (tagName.toUpperCase() === 'FEN') {
      this.haveFEN = true;
      try {
        this.chess.load(tagValue.trim());
        this.rootNode.fen = tagValue.trim();
      } catch {
        /* invalid FEN */
      }
    }
  }

  createNode(move: Move, fen: string): ChessNode {
    const side = move.color === 'w' ? 'red' : 'black';
    const node: ChessNode = {
      id: `node-${this.nodeId++}`,
      fen,
      move,
      step: this.currentStep,
      side,
      parentID: this.currentNode.id,
      children: [],
      mainID: null,
      comments: [],
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

  processSAN(san: string) {
    const fen = this.currentNode.fen;
    this.chess.load(fen);
    try {
      const move = this.chess.move(san);
      if (!move) return;
      const newNode = this.createNode(move, this.chess.fen());
      this.currentNode.children.push(newNode);
      this.currentNode = newNode;
      this.currentStep++;
      this.currentSide = move.color === 'w' ? 'red' : 'black';
    } catch {
      /* invalid move */
    }
  }

  parseVariation() {
    this.consume(); // consume '('

    const variationParentID = this.currentNode.parentID;
    if (!variationParentID) {
      while (!this.match('right-paren') && !this.match('eof')) this.consume();
      if (this.match('right-paren')) this.consume();
      return;
    }
    const variationBase = this.nodeMap.get(variationParentID)!;
    const prevState = {
      node: this.currentNode,
      step: this.currentStep,
      side: this.currentSide,
    };

    this.currentNode = variationBase;
    this.currentStep = variationBase.step!;
    this.currentSide = variationBase.side;

    while (!this.match('right-paren') && !this.match('eof')) {
      if (this.match('iccs-move')) {
        this.processSAN(this.consume().value);
      } else if (this.match('wxf-move')) {
        this.consume();
      } else if (this.match('comment')) {
        this.parseComment();
      } else if (this.match('left-paren')) {
        this.parseVariation();
      } else if (this.match('result')) {
        this.consume();
        break;
      } else {
        this.consume();
      }
    }

    if (this.match('right-paren')) this.consume();

    this.currentNode = prevState.node;
    this.currentStep = prevState.step;
    this.currentSide = prevState.side;
  }

  parseComment() {
    const token = this.consume();
    const comment = token.value.replace(/^{|}$/g, '').replace(/^;/, '').trim();

    if (!this.currentNode.comments) this.currentNode.comments = [];
    this.currentNode.comments.push(comment);
  }

  parseResult() {
    const token = this.consume();
    let result = '';
    switch (token.value) {
      case '1-0':
        result = 'R+';
        break;
      case '0-1':
        result = 'B+';
        break;
      case '1/2-1/2':
        result = '=';
        break;
      case '*':
        result = '?';
        break;
    }
    if (!this.currentNode.comments) this.currentNode.comments = [];
    this.currentNode.comments.push(result);
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
