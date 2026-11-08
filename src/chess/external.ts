import type { Move, Piece } from "@weshell/xiangqi.js";
import type { ChessNode, IHost } from "../types";
import { DEFAULT_FEN, PIECE_CHARS } from "./constants";

// ========== Online Analysis Sites ==========
export interface AnalysisSite {
  label: string;
  labelZh: string;
  icon: string;
  positionUrl: (host: IHost) => string;
  gameUrl: (host: IHost) => string;
}

function buildBranchIccs(host: IHost): string {
  const nodes: ChessNode[] = [];
  let node: ChessNode | null = host.currentNode;
  while (node) {
    nodes.push(node);
    node = node.parentID ? (host.nodeMap.get(node.parentID) ?? null) : null;
  }
  nodes.reverse();
  const moves: string[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const move = nodes[i].move;
    if (!move?.iccs) continue;
    moves.push(move.iccs.replace("-", "").toLowerCase());
  }
  return moves.join("");
}

export const ANALYSIS_SITES: AnalysisSite[] = [
  {
    label: "Pikafish",
    labelZh: "皮卡鱼",
    icon: "external-link",
    positionUrl: (host) => `https://xiangqiai.com/#/${host.fen}`,
    gameUrl: (host) => {
      const moves = buildBranchIccs(host);
      if (!moves) return `https://xiangqiai.com/#/${host.root.fen}`;
      return `https://xiangqiai.com/#/${host.root.fen} moves ${moves}`;
    },
  },
];

// ========== Other ==========
export function parseExternalUrl(source: string): string | null {
  const data = parsePikafishUrl(source);
  if (!data) return null;
  const { initFEN, PGN } = data;
  const lines = [`[FEN "${initFEN}"]`];
  const moves = PGN.map((m) => m.iccs ?? "").filter(Boolean);
  for (let i = 0; i < moves.length; i += 2) {
    lines.push(
      `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ""}`.trim(),
    );
  }
  return lines.join("\n");
}

export function createPieceFromChar(char: string): Piece | null {
  if (!PIECE_CHARS) return null;
  const map = PIECE_CHARS;
  for (const [key, val] of Object.entries(map)) {
    if (val === char) {
      const isUpper = key === key.toUpperCase();
      return {
        type: key.toLowerCase() as Piece["type"],
        color: isUpper ? "w" : "b",
      };
    }
  }
  return null;
}

function parsePikafishUrl(source: string): {
  initFEN: string;
  PGN: Move[];
} | null {
  const urlMatch = source.match(/xiangqiai\.com\/#\/(.+)/);
  if (!urlMatch) return null;
  try {
    const decoded = decodeURIComponent(urlMatch[1]);
    const parts = decoded.split(" moves ");
    const initFEN = parts[0] || DEFAULT_FEN;
    const moves: Move[] = [];
    if (parts[1]) {
      const moveStrs = parts[1].trim().split(/\s+/);
      for (const m of moveStrs) {
        const iccs =
          m.length === 4
            ? `${m[0].toUpperCase()}${m[1]}-${m[2].toUpperCase()}${m[3]}`
            : m;
        moves.push({ iccs } as Move);
      }
    }
    return { initFEN, PGN: moves };
  } catch {
    return null;
  }
}
