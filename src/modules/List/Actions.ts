import { MarkdownView, Notice } from 'obsidian';

import { Chess, type Move } from '../../chess';
import { registerListModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { IListHost, ITurn } from '../../types';
import { ConfirmModal } from '../../utils/confirmModal';

const ActionsModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on('runmove', (move: Move) => {
      if (!move) return;
      if (!host.modified) host.modifiedStep = host.currentStep;
      host.modified = true;
      eventBus.emit('edithistory', move);
      host.fen = move.after;
      host.currentStep++;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI', 'runmove');
    });

    eventBus.on('undo', () => {
      undo(host);
      eventBus.emit('updateUI', 'undo');
    });

    eventBus.on('redo', () => {
      redo(host);
      eventBus.emit('updateUI', 'redo');
    });

    eventBus.on('toStart', () => {
      while (host.currentStep !== 0) {
        undo(host);
      }
      eventBus.emit('updateUI', 'toStart');
    });

    eventBus.on('toEnd', () => {
      const step = host.modified ? host.history.length : host.PGN.length;
      const dif = step - host.currentStep;
      for (let i = 0; i < dif; i++) {
        redo(host);
      }
      eventBus.emit('updateUI', 'toEnd');
    });

    eventBus.on('reset', () => {
      if (host.modified) {
        while (host.currentStep !== 0) {
          undo(host);
        }
        host.modified = false;
        host.history = [];
        if (host.modifiedStep) {
          for (let i = 0; i < host.modifiedStep; i++) {
            redo(host);
          }
        }
        host.modifiedStep = null;
        eventBus.emit('updateUI', 'reset');
      } else {
        eventBus.emit('toStart');
      }
    });

    eventBus.on('save', async () => {
      let message = '';
      if (host.history.length === 0 && host.PGN.length === 0) {
        new Notice(t('notice.saveEmpty'));
        return;
      }
      if (host.history.length === 0 && host.PGN.length > 0) message = t('confirm.saveClear');
      if (host.history.length > 0 && host.PGN.length === 0) message = t('confirm.saveNew');
      if (host.history.length > 0 && host.PGN.length > 0) message = t('confirm.saveOverwrite');
      const modal = new ConfirmModal(
        host.plugin.app,
        t('confirm.saveTitle'),
        message,
        t('confirm.saveBtn'),
        t('confirm.cancel'),
      );

      modal.open();
      const userConfirmed = await modal.promise;

      if (userConfirmed) {
        await savePGN(host);
        new Notice(t('notice.saveSuccess'));
      }
      eventBus.emit('updateUI', 'save');
    });

    eventBus.on('clickstep', step => {
      if (step === undefined || step === host.currentStep) return;
      host.currentStep = step;
      host.fen = replayFen(host);
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('rotate', () => {
      if (!host.options) host.options = { rotated: true };
      else host.options.rotated = !host.options.rotated;
      eventBus.emit('updateUI', 'rotate');
    });
  },
};

registerListModule('actions', ActionsModule);

function undo(host: IListHost) {
  if (host.currentStep > 0) {
    host.currentStep--;
    host.fen = replayFen(host);
    host.currentTurn = getTurnFromFen(host.fen);
  }
}

function redo(host: IListHost) {
  if (!host.modified && host.PGN.length > 0) {
    const nextMove = host.PGN[host.currentStep];
    if (!nextMove) return;
    host.eventBus.emit('edithistory', nextMove);
    host.currentStep++;
    host.fen = nextMove.after;
    host.currentTurn = getTurnFromFen(host.fen);
  } else {
    if (host.history.length < host.currentStep) return;
    const moveToRedo = host.history[host.currentStep];
    if (!moveToRedo) return;
    host.currentStep++;
    host.fen = moveToRedo.after;
    host.currentTurn = getTurnFromFen(host.fen);
  }
}

function replayFen(host: IListHost): string {
  const chess = new Chess(host.initFEN);
  const currentMoves = host.modified ? host.history : host.PGN;
  for (let i = 0; i < host.currentStep; i++) {
    const move = currentMoves[i];
    if (!move) break;
    try {
      chess.move(move.iccs);
    } catch {
      // fallback: try lan (ICCS format, e.g. "h2e2")
      // console.log(`Failed to apply move ${move.zh}, trying ICCS format...`);
      chess.move(move.zh);
    }
  }
  return chess.fen();
}

function getTurnFromFen(fen: string): ITurn {
  return fen.split(' ')[1] === 'b' ? 'black' : 'red';
}

async function savePGN(host: IListHost) {
  const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;
  const file = view.file;
  if (!file) return;

  host.plugin.app.vault.process(file, fileContent => {
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return fileContent;
    const { lineStart, lineEnd } = section;
    const lines = fileContent.split('\n');
    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);
    if (blockLines.length < 2) return fileContent;

    blockLines = blockLines.filter(line => !/\b[A-I][0-9]+[-+][A-I][0-9]+\b/.test(line));

    if (host.currentStep > 0) {
      const moves = host.history.slice(0, host.currentStep).map((move: Move) => move.iccs ?? '');
      const pgnLines: string[] = [];
      for (let i = 0; i < moves.length; i += 2) {
        const line = `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ''}`.trim();
        pgnLines.push(line);
      }
      blockLines.splice(blockLines.length - 1, 0, pgnLines.join('\n'));
    }

    const newContent = [...lines.slice(0, lineStart), ...blockLines, ...lines.slice(lineEnd + 1)].join('\n');
    return newContent;
  });
}
