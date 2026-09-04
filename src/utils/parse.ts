import { Chess, type Move } from "../chess";
import { DEFAULT_FEN, FEN_REGEX, parseExternalUrl } from "../chess";
import { PGNParser } from "../modules/Source/parser";
import {
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
} {
  const resolved = parseExternalUrl(source) ?? source;
  const options = parseOption(resolved);

  let fen = resolved.match(FEN_REGEX)?.[0] ?? DEFAULT_FEN;

  const firstTurn: ITurn = fen.split(" ")[1] === "b" ? "black" : "white";

  const sanStrings = extractSANMoves(resolved);
  const chess = new Chess(fen);
  const PGN: Move[] = [];

  for (const san of sanStrings) {
    try {
      const move = chess.move(san);
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

function extractSANMoves(source: string): string[] {
  const clean = source
    .replace(/[rnbqkpRNBQKP1-8/]+\s+[wb].*/g, "")
    .replace(/^[pr]\s*[:：].*/gim, "");

  const movePattern =
    /\b(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/g;
  const matches = clean.match(movePattern);
  if (!matches) return [];

  return matches.filter((m) => !/^\d+\.?$/.test(m));
}

export function parseOption(source: string): IOptions {
  const options: IOptions = {};
  const oldPatterns: { key: string; regex: RegExp }[] = [
    { key: "protected", regex: /\b(protected|P)\s*[:：]\s*(true|false)\s*/i },
    { key: "rotated", regex: /\b(rotated|r)\s*[:：]\s*(true|false)\s*/i },
  ];
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

  host.generation++;

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
