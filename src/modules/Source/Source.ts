import {
  registerGenFENModule,
  registerTreeModule,
} from "../../core/module-system";
import {
  DEFAULT_FEN,
  type IGenFENHost,
  type IOptions,
  type ITreeHost,
} from "../../types";
import { parseOption, parsePikafishUrl, parseSource } from "../../utils/parse";

import { PGNParser } from "./parser";

function pikafishToPgn(source: string): string | null {
  const data = parsePikafishUrl(source);
  if (!data) return null;
  const { initFEN, PGN } = data;
  const lines: string[] = [`[FEN "${initFEN}"]`];
  const moves = PGN.map((m) => m.iccs ?? "").filter(Boolean);
  for (let i = 0; i < moves.length; i += 2) {
    lines.push(
      `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ""}`.trim(),
    );
  }
  return lines.join("\n");
}

function prepareSource(raw: string): { options: IOptions; clean: string } {
  const source = pikafishToPgn(raw) ?? raw;
  const options = parseOption(source);
  let clean = source
    .replace(/^[pr]\s*[:：].*$/gim, "")
    .replace(/^(?:protected|rotated)\s*[:：].*$/gim, "")
    .trim();
  const tags: string[] = [];
  if (options.protected !== undefined)
    tags.push(`[Protected "${options.protected}"]`);
  if (options.rotated !== undefined)
    tags.push(`[Rotated "${options.rotated}"]`);
  if (tags.length > 0) clean = tags.join("\n") + "\n" + clean;
  return { options, clean };
}

const SourceModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>("load", (renderChild) => {
      const { options, clean: cleanSource } = prepareSource(host.source);

      switch (renderChild) {
        case "tree": {
          const treeHost = host as ITreeHost;
          treeHost.options = options;
          const parser = new PGNParser(cleanSource);
          treeHost.parser = parser;
          treeHost.haveFEN = parser.haveFEN;
          treeHost.root = parser.getRoot();
          treeHost.nodeMap = parser.getMap();
          treeHost.tags = parser.getTags();
          treeHost.currentNode = treeHost.nodeMap.get("node-root")!;
          treeHost.fen = treeHost.currentNode.fen;
          treeHost.currentTurn = getTurnFromFen(treeHost.currentNode.fen);
          eventBus.emit("updateMainPath");

          const shouldJump =
            host.settings.autoJump === "always" ||
            (host.settings.autoJump === "auto" && !treeHost.haveFEN);
          if (shouldJump && treeHost.currentPath.length > 0) {
            treeHost.currentNode = treeHost.nodeMap.get(
              treeHost.currentPath[treeHost.currentPath.length - 1],
            )!;
            treeHost.fen = treeHost.currentNode.fen;
          }
          break;
        }

        case "fen": {
          const parsed = parseSource(host.source);
          host.fen = parsed.fen;
          break;
        }
      }
    });

    eventBus.on("full", () => {
      host.fen = DEFAULT_FEN;
    });
  },
};

registerGenFENModule("source", SourceModule);
registerTreeModule("source", SourceModule);

function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}
