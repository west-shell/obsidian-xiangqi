import type { MarkdownPostProcessorContext } from 'obsidian';

import type { Move, Square } from './chess';
import type { EventBus } from './core/event-bus';
import type ChessPlugin from './main';
import type { PGNParser } from './modules/Source/parser';
import type { ThemeName } from './themes';

export const DEFAULT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

export const PIECE_CHARS = {
  k: '将',
  a: '士',
  b: '象',
  r: '车',
  n: '马',
  c: '砲',
  p: '卒',
  K: '帅',
  A: '仕',
  B: '相',
  R: '俥',
  N: '傌',
  C: '炮',
  P: '兵',
} as const;

export interface ISettings {
  lang: 'auto' | 'en' | 'zh';
  position: 'bottom' | 'right';
  theme: ThemeName;
  cellSize: number;
  fontSize: number;
  showCoordinateLabels: boolean;
  showLastMove: boolean;
  showNextMove: boolean;
  showTurnBorder: boolean;
  autoJump: 'never' | 'always' | 'auto';
  enableSpeech: boolean;
  showMovelist: boolean;
  showMovelistText: boolean;
  boardMarginTop: number;
  boardMarginBottom: number;
  viewOnly?: boolean;
  rotated?: boolean;
  codeBlockNames: {
    xiangqi: string[];
    xq: string[];
    tree: string[];
  };
  genfenSaveType: 'xiangqi' | 'tree';
  enablePGNView: boolean;
  pgnFileExtensions: string[];
}

export type IOptions = {
  protected?: boolean;
  rotated?: boolean;
};

export type ITurn = 'white' | 'black';

export type ChessNode = {
  id: string;
  fen: string;
  move: Move | null;
  side: string | null;
  step?: number;
  x?: number;
  y?: number;
  parentID?: string | null;
  mainID?: string | null;
  children: ChessNode[];
  comments?: string[];
};

export type NodeMap = Map<string, ChessNode>;

export interface IHost {
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  plugin: ChessPlugin;
  eventBus: EventBus;
  settings: ISettings;
  source: string;
}

export interface IGenFENHost extends IHost {
  fen: string;
  selectedPiece: string | null;
  markedPos: Square | null;
  Chess: any;
}

export interface IListHost extends IGenFENHost {
  fen: string;
  initFEN: string;
  history: ChessNode[];
  PGN: ChessNode[];
  currentTurn: ITurn;
  currentStep: number;
  modified: boolean;
  modifiedStep: number | null;
  haveFEN: boolean;
  options: IOptions;
  nodeMap: NodeMap;
  root: ChessNode;
  stringifyPGN?: (root: ChessNode) => string;
}

export interface ITreeHost extends IGenFENHost {
  parser: PGNParser;
  fen: string;
  tags: string;
  root: ChessNode;
  nodeMap: NodeMap;
  currentStep: number;
  currentTurn: ITurn;
  currentNode: ChessNode;
  currentPath: string[];
  modified: boolean;
  haveFEN: boolean;
  options: IOptions;
  stringifyPGN: (root: ChessNode) => string;
}

export interface IPGNViewHost extends ITreeHost {
  data: string;
  contentEl: HTMLElement;
  saveFile: () => void;
}
