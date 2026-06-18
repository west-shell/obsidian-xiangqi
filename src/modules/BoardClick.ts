import { Chess, type Square } from '../chess';
import { registerListModule, registerPGNViewModule, registerTreeModule } from '../core/module-system';
import type { IGenFENHost, IListHost, ITreeHost } from '../types';

const BoardClickModule = {
  init(host: IListHost | ITreeHost | IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on('click', (clickedKey: string) => {
      if (!host.markedPos) {
        host.markedPos = clickedKey as Square;
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
          host.markedPos = clickedKey as Square;
          eventBus.emit('updateUI');
        }
      } catch {
        host.markedPos = null;
        eventBus.emit('updateUI');
      }
    });
  },
};

registerListModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
registerTreeModule('BoardClick', BoardClickModule);
