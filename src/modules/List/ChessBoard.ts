import { mount, unmount } from "svelte";

import type { Square } from "../../chess";
import { registerListModule } from "../../core/module-system";
import Chess from "../../lib/List/Chess.svelte";
import type { IListHost } from "../../types";

const BoardModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on("creatUI", () => {
      host.modified = false;
      const Container = host.containerEl.createDiv();
      host.Chess = mount(Chess, {
        target: Container,
        props: {
          settings: host.settings,
          fen: host.fen,
          checkColor: null,
          selectedSquare: null,
          currentStep: host.currentStep,
          eventBus: host.eventBus,
          modified: host.modified,
          PGN: host.PGN,
          history: host.history,
          lastMove: null,
          options: host.options || {},
        },
      });
    });

    eventBus.on("ready", () => {
      // autoJump 逻辑已移至 Source.ts 加载阶段
    });

    eventBus.on("updateUI", () => {
      const currentMoves = host.modified ? host.history : host.PGN;
      const lastNode = currentMoves[host.currentStep - 1] ?? null;
      const lastMove = lastNode?.move
        ? ([lastNode.move.from, lastNode.move.to] as [Square, Square])
        : null;
      const checkColor =
        lastNode?.move && (lastNode.move.isCheck || lastNode.move.isCheckmate)
          ? lastNode.move.color === "w"
            ? "black"
            : "white"
          : null;
      host.Chess?.$set({
        settings: { ...host.settings },
        fen: host.fen,
        checkColor,
        selectedSquare: null,
        currentStep: host.currentStep,
        modified: host.modified,
        history: [...host.history],
        lastMove,
        options: { ...host.options },
      });
    });

    eventBus.on("unload", () => {
      void unmount(host.Chess);
    });
  },
};

registerListModule("board", BoardModule);
