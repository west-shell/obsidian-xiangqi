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
import type { ThemeName } from "./style/themes";

export { DEFAULT_FEN };

export interface ISettings {
  lang: "auto" | "en" | "zh";
  theme: ThemeName;
  pieceSet: string;
  zoom: number;
  fontSize: number;
  showCoordinateLabels: boolean;
  showLastMove: boolean;
  showNextMove: boolean;
  showOtherVariations: boolean;
  showTurnBorder: boolean;
  autoJump: "never" | "always" | "auto";
  enableSpeech: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  showMovelist: boolean;
  notationType: string;
  showListEval: boolean;
  showListAnnotation: boolean;
  showListGlyph: boolean;
  showListCommentMark: boolean;
  showPreview: boolean;
  boardMarginTop: number;
  boardMarginBottom: number;
  viewOnly?: boolean;
  rotated?: boolean;
  treeBlockNames: string[];
  fenBlockNames: string[];
  fenSaveBlockName: string;
  enableFileHost: boolean;
  pgnFileExtensions: string[];
  /**
   * Default vault folder for PGN files created via the ribbon action. Empty
   * string = the vault root.
   */
  newPgnFolder: string;
  engineDepth: number;
  engineSkillLevel: number;
  showEngineBestMove: boolean;
  showEnginePonder: boolean;
  showEngineAnnotations: boolean;
  showBoardAnnotations: boolean;
  saveEvalByDefault: boolean;
  saveEvalPrompt: boolean;
  annotationFormat: AnnotationFormat;
  /**
   * Default vault folder for image/GIF exports. Empty string = follow
   * Obsidian's attachment folder setting.
   */
  exportFolder: string;
}

/**
 * How glyphs and annotations are written into the PGN on save:
 * - "suffix": glyph symbol after the move (e4!?), study NAGs as $n (default)
 * - "nag": everything numeric ($1, $16)
 * - "comment": bracketed symbol blocks ({[!?]}, {[±]})
 */
export type AnnotationFormat = "suffix" | "nag" | "comment";

export type IOptions = {
  protected?: boolean;
  rotated?: boolean;
};

export type ITurn = "white" | "black";

export type PvLine = {
  score: number;
  scoreType: "cp" | "mate";
  moves: string[];
};

export type NodeEval = {
  score: number;
  scoreType: "cp" | "mate";
  depth: number;
  bestmove?: string;
  ponder?: string;
  pvs?: PvLine[];
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
  /**
   * Study glyph / custom annotation keys on this node. NAG-number keys
   * ("16" for ±) export as $n; legacy custom keys ("+","-","=","bm","st")
   * keep the private #a: form. Position keys are mutually exclusive; the
   * rest stack freely.
   */
  annotations?: string[];
  shapes?: NodeShape[];
  /** Remaining clock time after this move ("H:MM:SS"), from lichess [%clk]. */
  clock?: string;
  /**
   * Per-comment annotation authors (lichess [%anno]), sparse array aligned
   * with `comments` by index; holes = unauthored comments. Cleared when the
   * user edits comment text, since rewritten lines lose their attribution.
   */
  commentAuthors?: ({ name: string; user: string } | undefined)[];
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

export type ParseWarningKind = "move" | "fen" | "unknown";

export type ParseWarning = {
  text: string;
  line: number;
  column: number;
  kind: ParseWarningKind;
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
  /**
   * Per-fork branch choices for the displayed path below the current
   * node (fork node id → chosen child index). View state only: never
   * saved into the PGN; reset whenever the tree or game is reloaded or
   * children are reordered.
   */
  pathChoices: Map<string, number>;
  /**
   * Ids of nodes whose extra children are folded away in the tree graph
   * (mirrored from Tree.svelte via the "folded-changed" event). Absent
   * until the first mirror arrives; treat as "nothing folded".
   */
  foldedNodes?: Set<string>;
  options: IOptions;
  /** Source content that failed to parse and was skipped (moves, FEN tags) */
  parseWarnings: ParseWarning[];
  stringifyPGN: (root: ChessNode, includeEval?: boolean) => string;
  games: GameSlot[];
  currentGameIndex: number;
  /** Bumped every time the underlying PGN data is replaced (file switch) */
  generation: number;
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
