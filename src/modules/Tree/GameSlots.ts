import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { t } from "../../i18n";
import type { GameSlot, IHost } from "../../types";
import { ConfirmModal } from "../../utils/confirmModal";
import { activateGame, extractHeaders } from "../Source/parse";
import { isFileHost } from "./Actions/shared";

const GameSlotsModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on<number>("switch-game", async (index) => {
      if (index === undefined || index < 0 || index >= host.games.length)
        return;
      if (host.modified) {
        const modal = new ConfirmModal(
          host.plugin.app,
          t("confirm.switchGameTitle"),
          t("confirm.switchGameMsg"),
          t("confirm.yes"),
          t("confirm.cancel"),
        );
        modal.open();
        if (!(await modal.promise)) return;
      }
      const prevSlot = host.games[host.currentGameIndex];
      if (prevSlot?.parsed) {
        prevSlot.parsed.tags = host.tags;
        prevSlot.parsed.root = host.root;
        prevSlot.parsed.nodeMap = host.nodeMap;
      }
      activateGame(host, index);
    });

    eventBus.on("create-game", () => {
      if (!isFileHost(host)) return;
      const tags = '[Result "*"]';
      const newSlot: GameSlot = {
        raw: tags,
        headers: extractHeaders(tags),
      };
      host.games.push(newSlot);
      host.eventBus.emit("modified", null);
      activateGame(host, host.games.length - 1);
    });

    eventBus.on("delete-game", async () => {
      if (!isFileHost(host)) return;
      if (host.games.length <= 1) return;
      const modal = new ConfirmModal(
        host.plugin.app,
        t("confirm.deleteGameTitle"),
        t("confirm.deleteGameMsg"),
        t("confirm.yes"),
        t("confirm.cancel"),
      );
      modal.open();
      if (!(await modal.promise)) return;
      const idx = host.currentGameIndex;
      host.games.splice(idx, 1);
      const newIdx = Math.min(idx, host.games.length - 1);
      host.eventBus.emit("modified", null);
      activateGame(host, newIdx);
    });

    eventBus.on<number>("move-game", (direction) => {
      if (!isFileHost(host)) return;
      if (!direction) return;
      const idx = host.currentGameIndex;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= host.games.length) return;
      const temp = host.games[idx];
      host.games[idx] = host.games[targetIdx];
      host.games[targetIdx] = temp;
      host.eventBus.emit("modified", null);
      activateGame(host, targetIdx);
    });
  },
};

registerFileModule("gameSlots", GameSlotsModule);
registerBlockModule("gameSlots", GameSlotsModule);
