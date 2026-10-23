import { PRIMARY_PLAYER_KEY } from "../../chess";
import { Modal, Setting } from "obsidian";
import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { t } from "../../i18n";
import type { IHost } from "../../types";
import { extractHeaders } from "../Source/parse";
import { emitNodeEval } from "./Actions/shared";

const EditTagsModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on<{ name: string; payload: unknown }>(
      "btn-click",
      async (payload) => {
        if (!payload || payload.name !== "edit-tags") return;
        host.markedPos = null;
        const tagPairs: { key: string; value: string }[] = [];
        const tagRe = /\[(\w+)\s+"([^"]*)"\]/g;
        let m: RegExpExecArray | null;
        while ((m = tagRe.exec(host.tags ?? "")) !== null) {
          if (m[1] === "FEN") continue;
          tagPairs.push({ key: m[1], value: m[2] });
        }
        const standardKeys = [
          "Event",
          "Site",
          "Date",
          "Round",
          PRIMARY_PLAYER_KEY,
          "Black",
        ];
        for (const key of standardKeys) {
          if (!tagPairs.some((p) => p.key === key)) {
            tagPairs.push({ key, value: "" });
          }
        }
        const tagsModal = new Modal(host.plugin.app);
        let resolve: (value: boolean) => void;
        const tagsPromise = new Promise<boolean>((r) => {
          resolve = r;
        });
        tagsModal.onOpen = () => {
          const { contentEl } = tagsModal;
          new Setting(contentEl)
            .setName(t("confirm.editTagsTitle", 0))
            .setHeading();
          for (const pair of tagPairs) {
            // [Result] stays in tagPairs (untouched) so the rebuilt
            // header preserves it, but it is not editable here:
            // results are set per branch via the result toolbar.
            if (pair.key === "Result") continue;
            const setting = new Setting(contentEl).setName(
              t(`tag.${pair.key}`, 0) || pair.key,
            );
            setting.addText((text) => {
              text.setValue(pair.value).onChange((v) => {
                pair.value = v;
              });
            });
          }
          const btnContainer = contentEl.createDiv("modal-button-container");
          const okBtn = btnContainer.createEl("button", {
            text: t("confirm.yes"),
            cls: "mod-cta",
          });
          okBtn.addEventListener("click", () => {
            resolve(true);
            tagsModal.close();
          });
          const cancelBtn = btnContainer.createEl("button", {
            text: t("confirm.cancel"),
          });
          cancelBtn.addEventListener("click", () => {
            resolve(false);
            tagsModal.close();
          });
        };
        tagsModal.onClose = () => {
          (tagsModal as { contentEl: HTMLElement }).contentEl.empty();
        };
        tagsModal.open();
        if (await tagsPromise) {
          const fenTag = (host.tags ?? "").match(/\[FEN\s+"[^"]*"\]/)?.[0];
          const edited = tagPairs
            .filter((p) => p.value)
            .map((p) => `[${p.key} "${p.value}"]`)
            .join("\n");
          host.tags = fenTag ? `${edited}\n${fenTag}` : edited;
          const slot = host.games[host.currentGameIndex];
          if (slot) {
            slot.headers = extractHeaders(host.tags);
            if (slot.parsed) slot.parsed.tags = host.tags;
          }
          eventBus.emit("modified", null);
          eventBus.emit("updateUI");
        }
        emitNodeEval(host);
        eventBus.emit("updateUI");
      },
    );
  },
};

registerFileModule("editTags", EditTagsModule);
registerBlockModule("editTags", EditTagsModule);
