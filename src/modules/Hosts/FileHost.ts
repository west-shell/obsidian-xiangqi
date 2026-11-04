import type { IFileHost } from "../../types";
import { activateGame, splitPGN } from "../Source/parse";
import { promptSaveInclusions } from "../../utils/saveEval";

export const FileHostModule = {
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
      const inclusions = await promptSaveInclusions(host);
      if (inclusions === null) return;

      const parts: string[] = [];
      for (let i = 0; i < host.games.length; i++) {
        const slot = host.games[i];
        if (slot.parsed) {
          if (i === host.currentGameIndex) {
            slot.parsed.tags = host.tags;
            slot.parsed.root = host.root;
            slot.parsed.nodeMap = host.nodeMap;
          }
          const pgn = host.stringifyPGN(
            slot.parsed.root,
            inclusions.eval,
            undefined,
            inclusions.pins,
          );
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
      // Revert the whole games list to the on-disk content, not just the
      // current slot: create/delete/move-game changes live in host.games
      // and must be undone too, otherwise the save button turns green
      // while memory still differs from disk.
      host.games = splitPGN(host.data);
      host.currentGameIndex = Math.min(
        host.currentGameIndex,
        host.games.length - 1,
      );
      activateGame(host, host.currentGameIndex);
    });
  },
};
