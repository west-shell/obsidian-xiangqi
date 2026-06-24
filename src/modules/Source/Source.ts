import { registerGenFENModule, registerListModule, registerTreeModule } from '../../core/module-system';
import { DEFAULT_FEN, type IGenFENHost, type IListHost, type ITreeHost, type IOptions } from '../../types';
import { parseOption, parsePikafishUrl } from '../../utils/parse';
import { stringifyPGN } from '../Tree/Actions';

import { PGNParser } from './parser';

/**
 * 将 pikafish URL 转为 PGNParser 可解析的 PGN 文本
 */
function pikafishToPgn(source: string): string | null {
  const data = parsePikafishUrl(source);
  if (!data) return null;
  const { initFEN, PGN } = data;
  const lines: string[] = [`[FEN "${initFEN}"]`];
  const moves = PGN.map(m => m.iccs ?? '').filter(Boolean);
  for (let i = 0; i < moves.length; i += 2) {
    lines.push(`${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ''}`.trim());
  }
  return lines.join('\n');
}

/**
 * 从源码中提取选项、删除旧格式 option 行、
 * 注入 PGN tag 格式，返回处理后的源码。
 */
function prepareSource(raw: string): { options: IOptions; clean: string } {
  // 如果是 pikafish URL，先转成 PGN 文本
  const source = pikafishToPgn(raw) ?? raw;
  const options = parseOption(source);
  // 删掉旧格式行
  let clean = source
    .replace(/^[pr]\s*[:：].*$/gim, '')
    .replace(/^(?:protected|rotated)\s*[:：].*$/gim, '')
    .trim();
  // 注入 PGN tag（仅当 source 中曾存在）
  const tags: string[] = [];
  if (options.protected !== undefined) tags.push(`[Protected "${options.protected}"]`);
  if (options.rotated !== undefined) tags.push(`[Rotated "${options.rotated}"]`);
  if (tags.length > 0) clean = tags.join('\n') + '\n' + clean;
  return { options, clean };
}

const SourceModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>('load', renderChild => {
      // 先提取选项，删除旧格式行，注入 PGN tag
      const { options, clean: cleanSource } = prepareSource(host.source);

      switch (renderChild) {
        case 'tree': {
          const treeHost = host as ITreeHost;
          treeHost.options = options;
          const parser = new PGNParser(cleanSource);
          treeHost.parser = parser;
          treeHost.haveFEN = parser.haveFEN;
          treeHost.root = parser.getRoot();
          treeHost.nodeMap = parser.getMap();
          treeHost.tags = parser.getTags();
          treeHost.currentNode = treeHost.nodeMap.get('node-root')!;
          treeHost.currentTurn = 'white';
          eventBus.emit('updateMainPath');

          // 根据 autoJump 设置决定初始节点位置
          const shouldJump =
            host.settings.autoJump === 'always' || (host.settings.autoJump === 'auto' && !treeHost.haveFEN);
          if (shouldJump && treeHost.currentPath.length > 0) {
            treeHost.currentNode = treeHost.nodeMap.get(
              treeHost.currentPath[treeHost.currentPath.length - 1],
            )!;
          }
          break;
        }
        case 'list': {
          const listHost = host as IListHost;
          const parser = new PGNParser(cleanSource);
          listHost.nodeMap = parser.getMap();
          listHost.root = parser.getRoot();
          listHost.haveFEN = parser.haveFEN;
          listHost.options = options;
          listHost.PGN = parser.getMainLine();
          listHost.history = [...listHost.PGN];
          listHost.stringifyPGN = stringifyPGN;
          listHost.currentTurn = 'white';
          listHost.initFEN = parser.getRoot().fen;

          // 根据 autoJump 设置决定初始步数和棋盘局面
          const shouldJump =
            host.settings.autoJump === 'always' || (host.settings.autoJump === 'auto' && !listHost.haveFEN);
          if (shouldJump) {
            const mainLine = parser.getMainLine();
            const last = mainLine[mainLine.length - 1];
            listHost.currentStep = mainLine.length;
            listHost.fen = last ? last.fen : listHost.initFEN;
          } else {
            listHost.currentStep = 0;
            listHost.fen = listHost.initFEN;
          }
          break;
        }

        case 'fen': {
          host.fen = host.source;
          break;
        }
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
