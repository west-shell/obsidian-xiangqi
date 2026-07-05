import { Chess, type Move } from "../chess";
import type { IOptions, ITurn } from "../types";
import { DEFAULT_FEN } from "../types";

export function parseSource(source: string): {
  haveFEN: boolean;
  fen: string;
  initFEN: string;
  PGN: Move[];
  firstTurn: ITurn;
  options: IOptions;
  isPikafishUrl?: boolean;
} {
  const options = parseOption(source);

  const pikafishData = parsePikafishUrl(source);
  if (pikafishData) {
    return { ...pikafishData, options, isPikafishUrl: true };
  }

  // try to find FEN in source
  let fen = source.match(
    /([rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+(?:\s+[wr])?/,
  )?.[0];
  if (!fen) {
    fen = DEFAULT_FEN;
  } else {
    // ensure full FEN format
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) fen += " w";
  }

  const firstTurn: ITurn = fen.split(" ")[1] === "b" ? "black" : "white";

  // parse ICCS moves from source using xiangqi.js
  const iccsStrings = extractICCSMoves(source);
  const chess = new Chess(fen);
  const PGN: Move[] = [];

  for (const iccs of iccsStrings) {
    try {
      const move = chess.move(iccs);
      if (move) PGN.push(move);
    } catch {
      // skip invalid moves
    }
  }

  const haveFEN = fen !== DEFAULT_FEN;
  return {
    haveFEN,
    fen: chess.fen(),
    initFEN: fen,
    PGN,
    firstTurn,
    options,
  };
}

export function parsePikafishUrl(source: string): {
  haveFEN: boolean;
  fen: string;
  initFEN: string;
  PGN: Move[];
  firstTurn: ITurn;
} | null {
  const match = source.match(/https:\/\/xiangqiai\.com\/#\/([^\s\n]+)/);
  if (!match) return null;

  let raw = match[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* ignore */
  }

  const parts = raw.split(/\s+moves\s+/);
  let fenPart = parts[0];
  const movesStr = parts[1] || "";

  const fenParts = fenPart.trim().split(/\s+/);
  if (fenParts.length < 2) fenPart += " w";
  const firstTurn: ITurn = fenPart.split(" ")[1] === "b" ? "black" : "white";

  const chess = new Chess(fenPart);
  let PGN: Move[] = [];

  if (movesStr) {
    const moveMatches = movesStr.match(/[a-i]\d[a-i]\d/gi);
    if (moveMatches) {
      for (const moveStr of moveMatches) {
        const fromFile = moveStr[0].toUpperCase();
        const fromRank = moveStr[1];
        const toFile = moveStr[2].toUpperCase();
        const toRank = moveStr[3];
        const iccs = `${fromFile}${fromRank}-${toFile}${toRank}`;
        try {
          const move = chess.move(iccs);
          if (move) PGN.push(move);
        } catch {
          /* skip */
        }
      }
    }
  }

  return {
    haveFEN: true,
    fen: chess.fen(),
    initFEN: fenPart,
    PGN,
    firstTurn,
  };
}

// --- ICCS move extraction ---

function extractICCSMoves(source: string): string[] {
  const clean = source
    .replace(/[rnbakcpRNBAKCP1-9/]+\s+[wr].*/g, "")
    .replace(/^[pr]\s*[:：].*/gim, "");
  // 直接匹配，交给 xiangqi.js 解析
  const movePattern = /\b[A-Ia-i][0-9]-?[A-Ia-i][0-9]\b/g;
  return clean.match(movePattern) ?? [];
}

// --- options parsing ---

export function parseOption(source: string): IOptions {
  const options: IOptions = {};
  // 旧格式: p:true / r:false / protected:true / Rotated：false
  const oldPatterns: { key: string; regex: RegExp }[] = [
    { key: "protected", regex: /\b(protected|P)\s*[:：]\s*(true|false)\s*/i },
    { key: "rotated", regex: /\b(rotated|r)\s*[:：]\s*(true|false)\s*/i },
  ];
  // 新格式: [Protected "true"] / [Rotated "false"]
  const tagPatterns: { key: string; regex: RegExp }[] = [
    { key: "protected", regex: /\[(?:Protected|P)\s+"(true|false)"\]/i },
    { key: "rotated", regex: /\[(?:Rotated|R)\s+"(true|false)"\]/i },
  ];
  for (const { key, regex } of [...oldPatterns, ...tagPatterns]) {
    const match = source.match(regex);
    if (match && options[key as keyof IOptions] === undefined) {
      options[key as keyof IOptions] =
        match[match.length - 1].toLowerCase() === "true";
    }
  }
  return options;
}
