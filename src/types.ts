import type { MarkdownPostProcessorContext, MarkdownSectionInformation } from 'obsidian';

import type { Move as XQMove } from './chess';
import type { EventBus } from './core/event-bus';
import type ChessPlugin from './main';
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

export type ITurn = 'red' | 'black';

export type ChessNode = {
  id: string;
  fen: string;
  move: XQMove | null;
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
export type IHistory = XQMove[];

export interface IHost {
  plugin: ChessPlugin;
  eventBus: EventBus;
}

export interface IXQHost extends IHost {
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext & {
    getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
  };
  fen: string;
  fenRoot: string;
  currentTurn: ITurn;
  history: IHistory;
  PGN: XQMove[];
  currentStep: number;
  modified: boolean;
  modifiedStep: number | null;
  markedPos?: unknown;
  settings: ISettings;
  rotated: boolean;
  options?: IOptions;
  haveFEN?: boolean;
  Chess?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  source: string;
}

export interface IGenFENHost extends IHost {
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext & {
    getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
  };
  fen: string;
  selectedPiece: string | null;
  settings: ISettings;
  file: { path: string };
}

export interface IPGNViewHost extends IHost {
  nodeMap: NodeMap;
  currentNode: ChessNode | null;
  currentPath: string[];
  settings: ISettings;
}
