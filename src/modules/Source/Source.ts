import { registerGenFENModule, registerListModule, registerTreeModule } from '../../core/module-system';
import { DEFAULT_FEN, type IGenFENHost, type IListHost, type ITreeHost } from '../../types';
import { parseSource } from '../../utils/parse';

import { PGNParser } from './parser';

const SourceModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>('load', renderChild => {
      const { haveFEN, fen, initFEN, PGN, firstTurn, options } = parseSource(host.source);
      switch (renderChild) {
        case 'tree': {
          const treeHost = host as ITreeHost;
          const parser = new PGNParser(treeHost.source);
          treeHost.parser = parser;
          treeHost.haveFEN = parser.haveFEN;
          treeHost.root = parser.getRoot();
          treeHost.nodeMap = parser.getMap();
          treeHost.tags = parser.getTags();
          treeHost.currentNode = treeHost.nodeMap.get('node-root')!;
          treeHost.currentTurn = 'red';
          eventBus.emit('updateMainPath');
          break;
        }
        case 'list':
          const listHost = host as IListHost;
          listHost.haveFEN = haveFEN;
          listHost.fen = fen;
          listHost.initFEN = initFEN;
          listHost.PGN = PGN;
          listHost.history = [...PGN];
          listHost.currentTurn = firstTurn;
          listHost.currentStep = 0;
          listHost.options = options;
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
