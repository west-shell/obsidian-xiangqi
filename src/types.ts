import type {
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  TextFileView,
} from "obsidian";

import type { Move, Piece, Square } from "./chess";
import { DEFAULT_FEN } from "./chess";
import type { EventBus } from "./core/event-bus";
import type ChessPlugin from "./main";
import type { PGNParser } from "./modules/Source/parser";
import type { ThemeName } from "./themes";

export { DEFAULT_FEN };

export interface ISettings {
  lang: "auto" | "en" | "zh";
  theme: ThemeName;
  zoom: number;
  fontSize: number;
  showCoordinateLabels: boolean;
  showLastMove: boolean;
  showNextMove: boolean;
  showOtherVariations: boolean;
  showTurnBorder: boolean;
  autoJump: "never" | "always" | "auto";
  enableSpeech: boolean;
  showMovelist: boolean;
  boardMarginTop: number;
  boardMarginBottom: number;
  viewOnly?: boolean;
  rotated?: boolean;
  treeBlockNames: string[];
  fenBlockNames: string[];
  fenSaveBlockName: string;
  enableFileHost: boolean;
  pgnFileExtensions: string[];
  engineDepth: number;
  engineSkillLevel: number;
  showEngineBestMove: boolean;
  showEnginePonder: boolean;
  showEngineAnnotations: boolean;
  showBoardAnnotations: boolean;
  saveEvalByDefault: boolean;
  saveEvalPrompt: boolean;
}

export type IOptions = {
  protected?: boolean;
  rotated?: boolean;
};

export type ITurn = "white" | "black";

export type NodeEval = {
  score: number;
  scoreType: "cp" | "mate";
  depth: number;
  bestmove?: string;
  ponder?: string;
};

export type MoveGlyph =
  | { symbol: "?!"; name: "Inaccuracy"; color: string }
  | { symbol: "?"; name: "Mistake"; color: string }
  | { symbol: "??"; name: "Blunder"; color: string }
  | { symbol: "!"; name: "Good move"; color: string }
  | { symbol: "!!"; name: "Brilliant"; color: string }
  | { symbol: "!?"; name: "Interesting"; color: string };

export type NodeShape = {
  orig: string;
  dest?: string;
  brush: string;
};

export type ChessNode = {
  id: string;
  fen: string;
  move: Move | null;
  /** Which color made this move ("white" | "black"), null for root node */
  color: string | null;
  step?: number;
  x?: number;
  y?: number;
  parentID?: string | null;
  children: ChessNode[];
  comments?: string[];
  eval?: NodeEval;
  glyph?: MoveGlyph | null;
  annotation?: string;
  shapes?: NodeShape[];
  isCheckmate?: boolean;
  result?: string;
};

export type NodeMap = Map<string, ChessNode>;

export type ParsedGame = {
  root: ChessNode;
  nodeMap: NodeMap;
  tags: string;
  parser: PGNParser;
};

export type GameSlot = {
  raw: string;
  headers: Map<string, string>;
  parsed?: ParsedGame;
};

type SvelteComponent = {
  $set?(props: Partial<Record<string, unknown>>): void;
  $destroy?(): void;
};

export interface IHost {
  plugin: ChessPlugin;
  eventBus: EventBus;
  settings: ISettings;
  fen: string;
  selectedPiece: Piece | null;
  markedPos: Square | null;
  Chess: SvelteComponent | null;
  editing: boolean;
  isFenMode: boolean;
  modified: boolean;
  parser: PGNParser;
  tags: string;
  root: ChessNode;
  nodeMap: NodeMap;
  currentStep: number;
  /** Which side is to move next */
  currentTurn: ITurn;
  currentNode: ChessNode;
  currentPath: string[];
  options: IOptions;
  stringifyPGN: (root: ChessNode, includeEval?: boolean) => string;
  games: GameSlot[];
  currentGameIndex: number;
}

export type IBlockHost = IHost &
  MarkdownRenderChild & {
    ctx: MarkdownPostProcessorContext;
    source: string;
  };

export type IFileHost = IHost &
  TextFileView & {
    saveFile: () => void;
  };
