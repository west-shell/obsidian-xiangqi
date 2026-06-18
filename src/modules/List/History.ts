import type { Move } from '../../chess';
import { registerListModule } from '../../core/module-system';
import type { IListHost } from '../../types';

const HistoryModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on('load', () => {
      host.modified = false;
    });

    eventBus.on('edithistory', (payload?: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      editHistory(host, payload as Move);
    });
  },
};

function editHistory(host: IListHost, move: Move) {
  let { currentStep, history } = host;

  const existingMove = history[currentStep];
  if (existingMove && existingMove.from === move.from && existingMove.to === move.to) {
    return;
  }

  host.history.splice(currentStep);
  host.history.push(move);
}

registerListModule('history', HistoryModule);
