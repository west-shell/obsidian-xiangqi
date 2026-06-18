import { mount, unmount } from 'svelte';

import type { Square } from '../../chess';
import { registerListModule } from '../../core/module-system';
import Chess from '../../lib/List/Chess.svelte';
import type { IListHost } from '../../types';

const BoardModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on('creatUI', () => {
      host.modified = false;
      const Container = host.containerEl.createEl('div');
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

    eventBus.on('ready', () => {
      if (!host.settings.autoJump) return;
      switch (host.settings.autoJump) {
        case 'never':
          break;
        case 'always':
          eventBus.emit('toEnd');
          break;
        case 'auto':
          if (!host.haveFEN) eventBus.emit('toEnd');
          break;
      }
    });

    eventBus.on('updateUI', () => {
      const currentMoves = host.modified ? host.history : host.PGN;
      const lastMove = currentMoves[host.currentStep - 1] ?? null;
      const checkColor =
        lastMove && (lastMove.isCheck || lastMove.isCheckmate)
          ? lastMove.color === 'w'
            ? 'black'
            : 'white'
          : null;
      host.Chess?.$set({
        settings: { ...host.settings },
        fen: host.fen,
        checkColor,
        selectedSquare: null,
        currentStep: host.currentStep,
        modified: host.modified,
        history: [...host.history],
        lastMove: lastMove ? ([lastMove.from, lastMove.to] as [Square, Square]) : null,
        options: { ...host.options },
      });
    });

    eventBus.on('unload', () => {
      unmount(host.Chess);
    });
  },
};

registerListModule('board', BoardModule);
