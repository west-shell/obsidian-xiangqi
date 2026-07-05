import { mount, unmount } from "svelte";

import { registerGenFENModule } from "../../core/module-system";
import GenFEN from "../../lib/GenFEN/GenFEN.svelte";
import type { IGenFENHost } from "../../types";

const BoardModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on("creatUI", () => {
      const Container = host.containerEl.createDiv();
      host.Chess = mount(GenFEN, {
        target: Container,
        props: {
          selectedPiece: host.selectedPiece,
          settings: host.settings,
          fen: host.fen,
          eventBus: host.eventBus,
        },
      });
    });

    eventBus.on("updateUI", () => {
      host.Chess?.$set?.({
        selectedPiece: host.selectedPiece,
        settings: { ...host.settings },
        fen: host.fen,
      });
    });

    eventBus.on("unload", () => {
      if (host.Chess) void unmount(host.Chess);
    });
  },
};

registerGenFENModule("board", BoardModule);
