import {
  buildDefaultEditFen,
  DEFAULT_FEN,
  EMPTY_FEN,
  type Piece,
  randomChess960Fen,
} from "../../chess";
import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { IHost } from "../../types";
import { validateFen } from "../../utils/chessEngine";
import { ConfirmModal } from "../../utils/confirmModal";
import { emitNodeEval } from "./Actions/shared";

const BTN_NAMES = new Set([
  "edit-board",
  "save",
  "empty",
  "full",
  "start",
  "random960",
  "turn",
  "reset",
  "flip",
]);

export const EditFenModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on<{ name: string; payload: unknown }>(
      "btn-click",
      async (payload) => {
        if (!payload || !BTN_NAMES.has(payload.name)) return;
        host.markedPos = null;
        const { name } = payload;
        const data = payload.payload as string;
        switch (name) {
          case "edit-board": {
            const modal = new ConfirmModal(
              host.plugin.app,
              t("confirm.editBoardTitle"),
              t("confirm.editBoardMsg"),
              t("confirm.yes"),
              t("confirm.cancel"),
            );
            modal.open();
            if (await modal.promise) {
              host.editing = true;
              host.selectedPiece = null;
              host.markedPos = null;
              eventBus.emit("updateUI");
            }
            break;
          }
          case "save": {
            if (host.editing) {
              const fen = data
                ? data
                : host.isFenMode
                  ? host.fen
                  : buildDefaultEditFen(host.fen.split(" ")[0]);
              const validation = validateFen(fen);
              if (!validation.ok) {
                new Notice(t("import.invalidFen"));
                return;
              }
              host.root.children = [];
              host.root.comments = [];
              host.root.fen = fen;
              host.nodeMap.clear();
              host.nodeMap.set(host.root.id, host.root);
              host.currentNode = host.root;
              host.fen = fen;
              host.tags = updateFenTag(host.tags, fen);
              if (!host.isFenMode) {
                host.editing = false;
                eventBus.emit("updateMainPath");
              }
              host.selectedPiece = null;
              host.markedPos = null;
              eventBus.emit("updateUI");
              eventBus.emit("save");
              break;
            }
            eventBus.emit("save");
            break;
          }
          case "empty": {
            if (!host.editing) break;
            host.fen = EMPTY_FEN;
            host.selectedPiece = null;
            break;
          }
          // "full" has no emitter today; it is kept alongside "start"
          // for behavior parity.
          case "full":
          case "start": {
            if (!host.editing) break;
            host.fen = DEFAULT_FEN;
            host.selectedPiece = null;
            break;
          }
          case "random960": {
            if (!host.editing) break;
            // Xiangqi's adapter returns null (no Chess960); guarded so
            // the shared handler stays variant-agnostic. A payload FEN
            // (the position chosen by number) wins over a fresh roll.
            const fen960 = data || randomChess960Fen();
            if (fen960) {
              host.fen = fen960;
              host.selectedPiece = null;
            }
            break;
          }
          case "turn": {
            if (!host.editing) break;
            const parts = host.fen.split(" ");
            while (parts.length < 2) parts.push("w");
            parts[1] = parts[1] === "w" ? "b" : "w";
            host.fen = parts.join(" ");
            break;
          }
          case "flip": {
            eventBus.emit("rotate");
            break;
          }
          // No emitter sends this name today; kept for behavior parity.
          case "reset": {
            eventBus.emit("reset");
            break;
          }
        }
        emitNodeEval(host);
        eventBus.emit("updateUI");
      },
    );

    eventBus.on<Piece>("clickPieceBTN", (piece) => {
      if (!piece) return;
      if (!host.editing) return;
      if (
        host.selectedPiece &&
        host.selectedPiece.type === piece.type &&
        host.selectedPiece.color === piece.color
      ) {
        host.selectedPiece = null;
      } else {
        host.selectedPiece = piece;
      }
      eventBus.emit("updateUI");
    });

    eventBus.on("exit-edit", () => {
      if (host.isFenMode) return;
      host.editing = false;
      host.selectedPiece = null;
      host.markedPos = null;
      eventBus.emit("updateUI");
    });
  },
};

function updateFenTag(tags: string, newFen: string): string {
  if (tags.includes('[FEN "')) {
    return tags.replace(/\[FEN "[^"]*"\]/, `[FEN "${newFen}"]`);
  }
  return `[FEN "${newFen}"]\n[SetUp "1"]\n${tags}`;
}
