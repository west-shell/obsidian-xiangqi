import { registerGenFENModule, registerListModule, registerTreeModule } from '../../core/module-system';
import { DEFAULT_FEN } from '../../types';
import { parseSource } from '../../utils/parse';

import { PGNParser } from './parser';

const SourceModule = {
  init(host: Record<string, any>) {
    const eventBus = host.eventBus;
    eventBus.on('load', (renderChild: string) => {
      if (renderChild === 'tree') {
        const parser = new PGNParser(host.source);
        host.parser = parser;
        host.haveFEN = parser.haveFEN;
        host.root = parser.getRoot();
        host.nodeMap = parser.getMap();
        host.tags = parser.getTags();
        host.currentNode = host.nodeMap.get('node-root');
        host.currentTurn = 'red';
        host.updateMainPath();
        return;
      }
      const { haveFEN, fen, initFEN, PGN, firstTurn, options } = parseSource(host.source);
      switch (renderChild) {
        case 'xq':
          host.haveFEN = haveFEN;
          host.fen = fen;
          host.initFEN = initFEN;
          host.PGN = PGN;
          host.history = [...PGN];
          host.currentTurn = firstTurn;
          host.currentStep = 0;
          host.options = options;
          break;
        case 'fen':
          host.fen = fen;
          break;
      }
    });

    eventBus.on('full', () => {
      host.fen = DEFAULT_FEN;
    });
  },
};

registerGenFENModule('source', SourceModule);
registerListModule('source', SourceModule);
registerTreeModule('source', SourceModule);
