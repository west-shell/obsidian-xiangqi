export const DEFAULT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w'
export interface ISettings {
	position: "bottom" | "right";
	theme: "light" | "dark";
	autoTheme: boolean;
	cellSize: number;
	fontSize: number;
	showLastMove: boolean;
	showTurnBorder: boolean;
	autoJump: "never" | "always" | "auto";
	enableSpeech: boolean;
	displayMovelist: boolean;
	displayMovelistText: boolean;
	viewOnly?: boolean;
	rotated?: boolean;
}
export type IOptions = {
	protected?: boolean;
	rotated?: boolean;
};
export type ITurn = "red" | "black";

export const PIECE_CHARS = {
	// 黑方 (小写)
	k: "将",
	a: "士",
	b: "象",
	r: "车",
	n: "马",
	c: "砲",
	p: "卒",
	// 红方 (大写)
	K: "帅",
	A: "仕",
	B: "相",
	R: "俥",
	N: "傌",
	C: "炮",
	P: "兵",
} as const;
export type PieceType = keyof typeof PIECE_CHARS;
export type IBoard = (PieceType | null)[][];
export type IPosition = { x: number; y: number };
export interface IMove {
	type?: PieceType;
	from: IPosition;
	to: IPosition;
	captured?: string | null;
	ICCS?: string;
	WXF?: string;
}
export type ChessNode = {
	id: string;
	data: IMove | null;
	step?: number;
	x?: number;
	y?: number;
	side: string | null;
	parentID?: string | null;
	mainID?: string | null;
	children: ChessNode[];
	board?: IBoard;
	comments?: string[];
};
export type NodeMap = Map<string, ChessNode>;
import type { SvelteComponent } from "svelte";
import type { MarkdownPostProcessorContext, MarkdownSectionInformation } from "obsidian";
import type XQPlugin from "./main";
import type { EventBus } from "./core/event-bus";
import type { BoardModule } from "./modules/Xiangqi/ChessBoard";

export type IHistory = IMove[];

export interface IHost {
	plugin: XQPlugin;
	eventBus: EventBus;
}

export interface IXQHost extends IHost {
	containerEl: HTMLElement;
	ctx: MarkdownPostProcessorContext & {
		getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
	};
	board: IBoard;
	currentTurn: ITurn;
	history: IHistory;
	PGN: IMove[];
	currentStep: number;
	modified: boolean;
	modifiedStep: number | null;
	markedPos: IPosition | null;
	settings: ISettings;
	rotated: boolean;
	options?: IOptions;
	haveFEN?: boolean;
	// Dynamically added modules
	BoardModule?: BoardModule;
	Xiangqi?: SvelteComponent;
}

export interface IGenFENHost extends IHost {
	containerEl: HTMLElement;
	ctx: MarkdownPostProcessorContext & {
		getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
	};
	board: IBoard;
	currentTurn: ITurn;
	markedPos: IPosition | null;
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
