import { registerBlockModule } from "../../core/module-system";
import {
  DEFAULT_FEN,
  FEN_REGEX,
  getTurnFromFen,
  parseExternalUrl,
} from "../../chess";
import { type IBlockHost, type ParsedGame } from "../../types";
import { hasFenTag, parseOption } from "../../utils/parse";

import { PGNParser } from "./parser";

function prepareSource(raw: string): {
  cleaned: string;
  options: ReturnType<typeof parseOption>;
} {
  const source = parseExternalUrl(raw) ?? raw;
  const options = parseOption(source);

  let cleaned = source.replace(
    /^(protected|P|rotated|R|r)\s*[:：]\s*(true|false)\s*$/gim,
    "",
  );

  const fenMatch = cleaned.match(FEN_REGEX);
  const hasFENTag = /\[FEN\s+"/.test(cleaned);
  if (fenMatch && !hasFENTag) {
    cleaned = cleaned.replace(fenMatch[0], `[FEN "${fenMatch[0]}"]`);
  }

  const tags: string[] = [];
  if (options.protected !== undefined)
    tags.push(`[Protected "${options.protected}"]`);
  if (options.rotated !== undefined)
    tags.push(`[Rotated "${options.rotated}"]`);
  if (tags.length > 0) {
    cleaned = tags.join("\n") + "\n" + cleaned;
  }

  return { cleaned, options };
}

function extractFEN(source: string): string {
  const fen = source.match(FEN_REGEX)?.[0];
  return fen ?? DEFAULT_FEN;
}

const SourceModule = {
  init(host: IBlockHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>("load", (renderChild) => {
      switch (renderChild) {
        case "tree": {
          host.isFenMode = false;
          const { cleaned, options: opts } = prepareSource(host.source);
          const parser = new PGNParser(cleaned);
          host.parser = parser;
          host.root = parser.getRoot();
          host.nodeMap = parser.getMap();
          host.tags = parser.getTags();
          host.options = opts;
          const game: ParsedGame = {
            root: host.root,
            nodeMap: host.nodeMap,
            tags: host.tags,
            parser,
          };
          host.games = [{ raw: cleaned, headers: new Map(), parsed: game }];
          host.currentGameIndex = 0;
          host.currentNode = host.nodeMap.get("node-root")!;
          host.fen = host.currentNode.fen;
          host.currentTurn = getTurnFromFen(host.currentNode.fen);
          eventBus.emit("updateMainPath");

          const shouldJump =
            host.settings.autoJump === "always" ||
            (host.settings.autoJump === "auto" && !hasFenTag(host.tags));
          if (shouldJump && host.currentPath.length > 0) {
            host.currentNode = host.nodeMap.get(
              host.currentPath[host.currentPath.length - 1],
            )!;
            host.fen = host.currentNode.fen;
          }
          break;
        }
        case "fen": {
          host.isFenMode = true;
          const fen = extractFEN(host.source);
          host.fen = fen;
          host.editing = true;
          host.parser = new PGNParser("");
          host.root = host.parser.getRoot();
          host.nodeMap = host.parser.getMap();
          host.currentNode = host.nodeMap.get("node-root")!;
          host.currentNode.fen = fen;
          host.currentTurn = getTurnFromFen(fen);
          host.tags = "";
          host.options = {};
          host.games = [];
          host.currentGameIndex = 0;
          eventBus.emit("updateMainPath");
          break;
        }
      }
    });

    eventBus.on("full", () => {
      host.fen = DEFAULT_FEN;
    });
  },
};

registerBlockModule("source", SourceModule);
