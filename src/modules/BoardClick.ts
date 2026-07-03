import { Chess, type Move, type Square } from '../chess';
import { registerListModule, registerPGNViewModule, registerTreeModule } from '../core/module-system';
import type { IListHost, IPGNViewHost, ITreeHost } from '../types';

type TryMovePayload = { from: Square; to: Square };

function tryMove(host: IListHost | ITreeHost | IPGNViewHost, from: Square, to: Square): void {
  const eventBus = host.eventBus;
  try {
    const chess = new Chess(host.fen);
    const move = chess.move({ from, to });
    if (move) {
      host.markedPos = null;
      eventBus.emit('runmove', move);
    } else {
      host.markedPos = to;
      eventBus.emit('updateUI');
    }
  } catch {
    host.markedPos = null;
    eventBus.emit('updateUI');
  }
}

const BoardClickModule = {
  init(host: IListHost | ITreeHost | IPGNViewHost) {
    const eventBus = host.eventBus;

    eventBus.on<Square>('click', clickedKey => {
      if (!clickedKey) return;
      if (!host.markedPos) {
        host.markedPos = clickedKey;
        eventBus.emit('updateUI');
        return;
      }
      tryMove(host, host.markedPos, clickedKey);
    });

    eventBus.on<TryMovePayload>('trymove', payload => {
      if (!payload) return;
      tryMove(host, payload.from, payload.to);
    });
  },
};

registerListModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
registerTreeModule('BoardClick', BoardClickModule);
