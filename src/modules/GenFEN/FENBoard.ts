import { mount, unmount } from 'svelte';

import { registerGenFENModule } from '../../core/module-system';
import GenFEN from '../../lib/GenFEN/GenFEN.svelte';

const BoardModule = {
  init(host: Record<string, any>) {
    const eventBus = host.eventBus;

    eventBus.on('load', () => {
      const Container = host.containerEl.createEl('div');
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

    eventBus.on('updateUI', () => {
      host.Chess?.$set({
        selectedPiece: host.selectedPiece,
        settings: { ...host.settings },
        fen: host.fen,
      });
    });

    eventBus.on('unload', () => {
      unmount(host.Chess);
    });
  },
};

registerGenFENModule('board', BoardModule);
