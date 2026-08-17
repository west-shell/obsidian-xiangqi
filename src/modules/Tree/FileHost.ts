import { registerFileModule } from "../../core/module-system";
import type { IFileHost } from "../../types";
import { activateGame, splitPGN } from "../../utils/parse";
import { promptSaveEval } from "../../utils/saveEval";

const FileHostModule = {
  init(host: IFileHost) {
    const eventBus = host.eventBus;

    eventBus.on("setViewData", () => {
      host.markedPos = null;
      const slots = splitPGN(host.data);
      host.games = slots;
      host.currentGameIndex = 0;
      activateGame(host, 0);
      host.currentTurn =
        host.currentNode.fen.split(" ")[1] === "b" ? "black" : "white";
    });

    eventBus.on("save", async () => {
      const includeEval = await promptSaveEval(host);
      if (includeEval === null) return;

      const parts: string[] = [];
      for (let i = 0; i < host.games.length; i++) {
        const slot = host.games[i];
        if (slot.parsed) {
          const pgn = host.stringifyPGN(slot.parsed.root, includeEval);
          const content = [slot.parsed.tags?.trim(), pgn]
            .filter(Boolean)
            .join("\n");
          slot.raw = content;
          parts.push(content);
        } else {
          parts.push(slot.raw.trim());
        }
      }
      host.data = parts.join("\n\n");
      host.saveFile();
    });

    eventBus.on("reset", () => {
      const slot = host.games[host.currentGameIndex];
      if (slot) slot.parsed = undefined;
      activateGame(host, host.currentGameIndex);
    });
  },
};

registerFileModule("fileHost", FileHostModule);
