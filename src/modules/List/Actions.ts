import { MarkdownView, Notice } from 'obsidian';

import type { Move } from '../../chess';
import { registerListModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { ChessNode, IListHost, ITurn } from '../../types';
import { SaveConfirmModal } from '../../utils/confirmModal';

const ActionsModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on<Move>('runmove', move => {
      if (!move) return;
      // 先检查当前节点下是否已有相同招法
      const parentNode = host.currentStep > 0 ? host.history[host.currentStep - 1] : host.root;
      for (const child of parentNode.children) {
        if (child.move?.from === move.from && child.move?.to === move.to) {
          // 已有该招法，直接跳转到它
          const idx = parentNode.children.indexOf(child);
          if (idx > 0) {
            parentNode.children.splice(idx, 1);
            parentNode.children.unshift(child);
          }
          host.history = [...host.history.slice(0, host.currentStep), child];
          host.currentStep++;
          host.fen = child.fen;
          host.currentTurn = getTurnFromFen(host.fen);
          host.modified = true;
          eventBus.emit('updateUI');
          return;
        }
      }
      // 新招法
      if (!host.modified) host.modifiedStep = host.currentStep;
      host.modified = true;
      eventBus.emit('edithistory', move);
      host.fen = move.after;
      host.currentStep++;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('undo', () => {
      undo(host);
      eventBus.emit('updateUI');
    });

    eventBus.on('redo', () => {
      redo(host);
      eventBus.emit('updateUI');
    });

    eventBus.on('toStart', () => {
      host.currentStep = 0;
      host.fen = host.root.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('toEnd', () => {
      const line = host.modified ? host.history : host.PGN;
      host.currentStep = line.length;
      const last = line[line.length - 1];
      host.fen = last ? last.fen : host.root.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('reset', () => {
      eventBus.emit('load', 'list');
      eventBus.emit('updateUI');
    });

    eventBus.on('delete', () => {
      if (host.currentStep === 0) return;
      host.history = host.history.slice(0, host.currentStep - 1);
      host.currentStep = host.history.length;
      host.fen = host.currentStep > 0 ? host.history[host.currentStep - 1].fen : host.root.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      host.modified = true;
      eventBus.emit('updateUI');
    });

    eventBus.on('save', async () => {
      if (host.history.length === 0 && host.PGN.length === 0) {
        new Notice(t('notice.saveEmpty'));
        return;
      }
      const hasBranches =
        host.history.some(n => n.children.length > 1) ||
        host.PGN.some(n => n.children.length > 1) ||
        host.root.children.length > 1;
      const modal = new SaveConfirmModal(host.plugin.app, hasBranches, t);
      modal.open();
      const saveMode = await modal.promise;

      if (saveMode === 'overwrite') {
        await savePGN(host);
        new Notice(t('notice.saveSuccess'));
      } else if (saveMode === 'update') {
        await saveAll(host);
        new Notice(t('notice.saveSuccess'));
      }
      eventBus.emit('updateUI');
    });

    eventBus.on<number>('clickstep', step => {
      if (step === undefined || step === host.currentStep) return;
      host.currentStep = step;
      const line = host.modified ? host.history : host.PGN;
      host.fen = step > 0 ? line[step - 1].fen : host.root.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('rotate', () => {
      eventBus.emit('updateUI');
    });

    eventBus.on('openPikafish', () => {
      const fen = host.root.fen;
      const line = host.modified ? host.history : host.PGN;
      const movesOnPath = line
        .map(n => n.move?.iccs?.replace(/-/g, '').toLowerCase())
        .filter(Boolean)
        .join('');
      window.open(`https://xiangqiai.com/#/${fen} moves ${movesOnPath}`);
    });
  },
};

registerListModule('actions', ActionsModule);

function undo(host: IListHost) {
  if (host.currentStep > 0) {
    host.currentStep--;
    host.fen = host.currentStep > 0 ? host.history[host.currentStep - 1].fen : host.root.fen;
    host.currentTurn = getTurnFromFen(host.fen);
  }
}

function redo(host: IListHost) {
  const line = host.modified ? host.history : host.PGN;
  if (host.currentStep < line.length) {
    const next = line[host.currentStep];
    if (!host.modified) {
      host.eventBus.emit('edithistory', next.move);
    }
    host.currentStep++;
    host.fen = next.fen;
    host.currentTurn = getTurnFromFen(host.fen);
  }
}

function getTurnFromFen(fen: string): ITurn {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function buildPgnText(nodes: ChessNode[]): string {
  if (nodes.length === 0) return '';
  const moves = nodes.map(n => n.move?.iccs ?? '').filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const line = `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ''}`.trim();
    lines.push(line);
  }
  return lines.join('\n');
}

async function savePGN(host: IListHost) {
  const pgnText = buildPgnText(host.history);
  const allTags = serializeTags(host.tags, host.options);
  await writeBlock(host, [allTags, pgnText].filter(Boolean).join('\n'));
}

async function saveAll(host: IListHost) {
  const pgnText = host.stringifyPGN?.(host.root) ?? buildPgnText(host.history);
  const allTags = serializeTags(host.tags, host.options);
  await writeBlock(host, [allTags, pgnText].filter(Boolean).join('\n'));
}

function serializeTags(
  tags: Map<string, string> | undefined,
  opts: { protected?: boolean; rotated?: boolean },
): string {
  const map = new Map(tags);
  if (opts.protected !== undefined) map.set('Protected', String(opts.protected));
  if (opts.rotated !== undefined) map.set('Rotated', String(opts.rotated));
  return [...map.entries()].map(([k, v]) => `[${k} "${v}"]`).join('\n');
}

async function writeBlock(host: IListHost, newContent: string) {
  const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view?.file) return;

  host.plugin.app.vault.process(view.file, fileContent => {
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return fileContent;
    const { lineStart, lineEnd } = section;
    const lines = fileContent.split('\n');
    const blockLines = lines.slice(lineStart, lineEnd + 1);
    if (blockLines.length < 2) return fileContent;

    const updated = [blockLines[0], newContent, blockLines[blockLines.length - 1]];
    return [...lines.slice(0, lineStart), ...updated, ...lines.slice(lineEnd + 1)].join('\n');
  });
}
