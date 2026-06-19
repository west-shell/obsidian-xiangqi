import { mount, unmount } from 'svelte';

import { registerPGNViewModule } from '../../core/module-system';
import Chess from '../../lib/Tree/Chess.svelte';
import type { IPGNViewHost } from '../../types';
import { PGNParser } from '../Source/parser';

const TreeViewModule = {
  init(host: IPGNViewHost) {
    const eventBus = host.eventBus;

    eventBus.on('setViewData', () => {
      host.markedPos = null;
      const parser = new PGNParser(host.data);
      host.parser = parser;
      host.haveFEN = parser.haveFEN;
      host.root = parser.getRoot();
      host.nodeMap = parser.getMap();
      host.tags = parser.getTags();
      host.currentNode = host.nodeMap.get('node-root')!;
      host.currentTurn = 'red';
      eventBus.emit('updateMainPath');
    });

    eventBus.on('createUI', () => {
      const Container = host.contentEl;
      Container.classList.add('pgn-view');
      host.Chess = mount(Chess, {
        target: Container,
        props: {
          nodeMap: host.nodeMap,
          settings: host.settings,
          fen: host.currentNode.fen,
          eventBus: host.eventBus,
          currentNode: host.currentNode,
          currentPath: host.currentPath,
        },
      });
    });

    eventBus.on('updateUI', () => {
      host.Chess?.$set({
        settings: { ...host.settings },
        nodeMap: new Map(host.nodeMap),
        fen: host.currentNode?.fen ?? '',
        currentNode: host.currentNode,
        currentPath: host.currentPath,
      });
    });

    eventBus.on('ready', () => {
      if (!host.settings.autoJump) return;
      switch (host.settings.autoJump) {
        case 'never':
          break;
        case 'always':
          eventBus.emit('btn-click', 'toEnd');
          break;
        case 'auto':
          if (!host.haveFEN) eventBus.emit('btn-click', 'toEnd');
          break;
      }
    });

    eventBus.on('reset', () => {
      eventBus.emit('setViewData');
      eventBus.emit('updateUI');
    });

    eventBus.on('save', () => {
      const pgn = host.stringifyPGN(host.root);
      const content = [host.tags?.trim(), pgn].filter(Boolean).join('\n');
      host.data = content;
      host.saveFile();
    });

    eventBus.on('unload', () => {
      unmount(host.Chess);
    });
  },
};

registerPGNViewModule('Tree', TreeViewModule);
