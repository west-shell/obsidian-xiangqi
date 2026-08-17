import { Chess, type Move } from "../chess";
import { PGNParser } from "../modules/Source/parser";
import {
  DEFAULT_FEN,
  type GameSlot,
  type IHost,
  type IOptions,
  type ITurn,
  type ParsedGame,
} from "../types";

export function hasFenTag(tags: string): boolean {
  return /\[FEN\s+"[^"]*"\]/.test(tags);
}

export function parseSource(source: string): {
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

  return {
    fen: chess.fen(),
    initFEN: fen,
    PGN,
    firstTurn,
    options,
  };
}

export function parsePikafishUrl(source: string): {
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

export function splitPGN(pgn: string): GameSlot[] {
  const lines = pgn.split("\n");
  const games: GameSlot[] = [];
  let currentLines: string[] = [];
  let hasMovetext = false;
  let hasTags = false;
  let commentDepth = 0;
  let blankAfterTags = false;

  for (const line of lines) {
    const trimmed = line.trim();

    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === "{") commentDepth++;
      else if (trimmed[i] === "}") commentDepth = Math.max(0, commentDepth - 1);
    }
    const inComment = commentDepth > 0;

    const isTagLine = /^\[\w+\s+"[^"]*"\]$/.test(trimmed);

    if (isTagLine && !inComment) {
      if (hasMovetext && currentLines.length > 0) {
        games.push(makeSlot(currentLines));
        currentLines = [];
        hasMovetext = false;
        hasTags = false;
        blankAfterTags = false;
      } else if (blankAfterTags && hasTags) {
        games.push(makeSlot(currentLines));
        currentLines = [];
        hasMovetext = false;
        hasTags = false;
        blankAfterTags = false;
      }
      currentLines.push(line);
      hasTags = true;
      blankAfterTags = false;
    } else if (trimmed === "") {
      if (hasTags && !hasMovetext) {
        blankAfterTags = true;
      }
      currentLines.push(line);
    } else if (!inComment) {
      hasMovetext = true;
      blankAfterTags = false;
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.some((l) => l.trim() !== "")) {
    games.push(makeSlot(currentLines));
  }

  if (games.length === 0) {
    games.push(makeSlot([""]));
  }

  return games;
}

function makeSlot(lines: string[]): GameSlot {
  const raw = lines.join("\n");
  const headers = extractHeaders(raw);
  return { raw, headers };
}

export function extractHeaders(raw: string): Map<string, string> {
  const headers = new Map<string, string>();
  const tagRe = /^\[(\w+)\s+"([^"]*)"\]$/gm;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(raw)) !== null) {
    headers.set(m[1], m[2]);
  }
  return headers;
}

export function activateGame(host: IHost, index: number): void {
  const slot = host.games[index];
  if (!slot) return;

  if (!slot.parsed) {
    const parser = new PGNParser(slot.raw);
    const game: ParsedGame = {
      root: parser.getRoot(),
      nodeMap: parser.getMap(),
      tags: parser.getTags(),
      parser,
    };
    slot.parsed = game;
  }

  const game = slot.parsed;
  host.parser = game.parser;
  host.root = game.root;
  host.nodeMap = game.nodeMap;
  host.tags = game.tags;
  host.currentNode = game.root;
  host.fen = game.root.fen;
  host.currentGameIndex = index;
  host.eventBus.emit("updateMainPath");

  const shouldJump =
    host.settings.autoJump === "always" ||
    (host.settings.autoJump === "auto" && !hasFenTag(host.tags));
  if (shouldJump && host.currentPath.length > 0) {
    host.currentNode = host.nodeMap.get(
      host.currentPath[host.currentPath.length - 1],
    )!;
    host.fen = host.currentNode.fen;
  }

  host.eventBus.emit("updateUI");
}
