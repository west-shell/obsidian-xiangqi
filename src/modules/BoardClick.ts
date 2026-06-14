import { Chess } from '../chess';
import { registerPGNViewModule, registerTreeModule, registerXQModule } from '../core/module-system';
import type { IXQHost } from '../types';

const BoardClickModule = {
  init(host: IXQHost) {
    const eventBus = host.eventBus;

    eventBus.on('click', (clickedKey: string) => {
      if (!host.markedPos) {
        host.markedPos = clickedKey;
        eventBus.emit('updateUI');
        return;
      }

      try {
        const chess = new Chess(host.fen);
        const move = chess.move({ from: host.markedPos as string, to: clickedKey });
        if (move) {
          host.markedPos = null;
          eventBus.emit('runmove', move);
        } else {
          host.markedPos = clickedKey;
          eventBus.emit('updateUI');
        }
      } catch {
        host.markedPos = null;
        eventBus.emit('updateUI');
      }
    });
  },
};

registerXQModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
registerTreeModule('BoardClick', BoardClickModule);
