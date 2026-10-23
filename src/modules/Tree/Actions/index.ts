import { CLS_PREFIX } from "../../../chess";
import type { IBlockHost, IHost } from "../../../types";
import { mount, unmount } from "svelte";
import Chess from "../../../lib/Tree/Chess.svelte";
import { isFileHost } from "./shared";

export const ActionsModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on("modified", () => {
      host.modified = true;
    });
    eventBus.on("save", () => {
      host.modified = false;
    });
    eventBus.on("load", () => {
      host.modified = false;
    });
    eventBus.on("setViewData", () => {
      host.modified = false;
    });
    eventBus.on("reset", () => {
      host.modified = false;
    });

    function chessProps() {
      return {
        nodeMap: new Map(host.nodeMap),
        settings: { ...host.settings },
        fen: host.editing ? host.fen : (host.currentNode?.fen ?? ""),
        eventBus: host.eventBus,
        currentNode: host.currentNode,
        currentPath: host.currentPath,
        options: { ...host.options },
        parseWarnings: host.parseWarnings,
        editing: host.editing,
        isFenMode: host.isFenMode,
        selectedPiece: host.selectedPiece,
        plugin: host.plugin,
        games: host.games,
        currentGameIndex: host.currentGameIndex,
        isBlockMode: !isFileHost(host),
      };
    }

    eventBus.on("createUI", () => {
      if (host.Chess) {
        void unmount(host.Chess);
        host.Chess = null;
      }

      let container: HTMLElement;
      if (isFileHost(host)) {
        container = host.contentEl;
        container.classList.add(`${CLS_PREFIX}-file-view`);
      } else {
        container = (host as IBlockHost).containerEl.createDiv();
      }

      host.modified = false;
      host.Chess = mount(Chess, {
        target: container,
        props: chessProps(),
      });
    });

    eventBus.on("updateUI", () => {
      host.Chess?.$set?.(chessProps());
    });

    eventBus.on("unload", () => {
      if (host.Chess) {
        void unmount(host.Chess);
        host.Chess = null;
      }
    });

    // Mirror of Tree.svelte's fold state (pure data, no UI update).
    eventBus.on<Set<string>>("folded-changed", (folded) => {
      host.foldedNodes = folded;
    });
  },
};
