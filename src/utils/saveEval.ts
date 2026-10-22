import { Modal, Setting } from "obsidian";

import type { ChessNode, IHost } from "../types";
import { t } from "../i18n";

export function hasEvalInTree(root: ChessNode): boolean {
  const stack: ChessNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.eval) return true;
    stack.push(...node.children);
  }
  return false;
}

export async function promptSaveEval(host: IHost): Promise<boolean | null> {
  if (!hasEvalInTree(host.root)) return true;

  if (!host.settings.saveEvalPrompt) {
    return host.settings.saveEvalByDefault;
  }

  let includeEval = host.settings.saveEvalByDefault;
  const modal = new Modal(host.plugin.app);
  let resolve: (value: boolean | null) => void;
  const promise = new Promise<boolean | null>((r) => {
    resolve = r;
  });

  modal.onOpen = () => {
    const { contentEl } = modal;
    new Setting(contentEl).setName(t("confirm.saveTitle")).setHeading();
    new Setting(contentEl)
      .setName(t("confirm.saveEval"))
      .addToggle((toggle) => {
        toggle.setValue(includeEval).onChange((val) => {
          includeEval = val;
        });
      });

    const btnContainer = contentEl.createDiv("modal-button-container");
    const saveBtn = btnContainer.createEl("button", {
      text: t("confirm.saveBtn"),
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => {
      resolve(includeEval);
      modal.close();
    });
    const cancelBtn = btnContainer.createEl("button", {
      text: t("confirm.cancel"),
    });
    cancelBtn.addEventListener("click", () => {
      resolve(null);
      modal.close();
    });
  };
  modal.onClose = () => {
    (modal as { contentEl: HTMLElement }).contentEl.empty();
  };
  modal.open();
  return promise;
}
