import { registerTreeModule } from "../../core/module-system";
import { DEFAULT_FEN, type IOptions, type ITreeHost } from "../../types";
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
  init(host: ITreeHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>("load", (renderChild) => {
      const { options, clean: cleanSource } = prepareSource(host.source);

      switch (renderChild) {
        case "tree": {
          host.options = options;
          const parser = new PGNParser(cleanSource);
          host.parser = parser;
          host.haveFEN = parser.haveFEN;
          host.root = parser.getRoot();
          host.nodeMap = parser.getMap();
          host.tags = parser.getTags();
          host.currentNode = host.nodeMap.get("node-root")!;
          host.fen = host.currentNode.fen;
          host.currentTurn = getTurnFromFen(host.currentNode.fen);
          eventBus.emit("updateMainPath");

          const shouldJump =
            host.settings.autoJump === "always" ||
            (host.settings.autoJump === "auto" && !host.haveFEN);
          if (shouldJump && host.currentPath.length > 0) {
            host.currentNode = host.nodeMap.get(
              host.currentPath[host.currentPath.length - 1],
            )!;
            host.fen = host.currentNode.fen;
          }
          break;
        }

        case "fen": {
          const parsed = parseSource(host.source);
          host.fen = parsed.fen;
          host.editing = true;
          host.parser = new PGNParser("");
          host.root = host.parser.getRoot();
          host.nodeMap = host.parser.getMap();
          host.currentNode = host.nodeMap.get("node-root")!;
          host.currentNode.fen = parsed.fen;
          host.currentTurn = getTurnFromFen(parsed.fen);
          host.tags = "";
          host.options = {};
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

registerTreeModule("source", SourceModule);

function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}
