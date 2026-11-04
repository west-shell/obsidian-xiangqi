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

/** True when any node carries a pinned comment/board marker. */
export function hasPinsInTree(root: ChessNode): boolean {
  const stack: ChessNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.pin?.comment || node.pin?.board) return true;
    stack.push(...node.children);
  }
  return false;
}

/** What gets written into the PGN on save. */
export interface SaveInclusions {
  eval: boolean;
  pins: boolean;
}

/**
 * Decide what to include when saving: evaluation scores and pinned-block
 * markers, each gated by its own "save by default" setting. One shared
 * "ask before saving" setting controls the confirmation modal, which
 * shows a toggle per item that exists in the tree; null means the user
 * cancelled the save.
 */
export async function promptSaveInclusions(
  host: IHost,
): Promise<SaveInclusions | null> {
  const hasEval = hasEvalInTree(host.root);
  const hasPins = hasPinsInTree(host.root);
  const ask = host.settings.saveEvalPrompt && (hasEval || hasPins);

  let includeEval = hasEval && host.settings.saveEvalByDefault;
  let includePins = hasPins && host.settings.savePinsByDefault;

  if (!ask) {
    return { eval: includeEval, pins: includePins };
  }

  const modal = new Modal(host.plugin.app);
  let resolve: (value: SaveInclusions | null) => void;
  const promise = new Promise<SaveInclusions | null>((r) => {
    resolve = r;
  });

  modal.onOpen = () => {
    const { contentEl } = modal;
    new Setting(contentEl).setName(t("confirm.saveTitle")).setHeading();
    if (hasEval) {
      new Setting(contentEl)
        .setName(t("confirm.saveEval"))
        .addToggle((toggle) => {
          toggle.setValue(includeEval).onChange((val) => {
            includeEval = val;
          });
        });
    }
    if (hasPins) {
      new Setting(contentEl)
        .setName(t("confirm.savePins"))
        .addToggle((toggle) => {
          toggle.setValue(includePins).onChange((val) => {
            includePins = val;
          });
        });
    }

    const btnContainer = contentEl.createDiv("modal-button-container");
    const saveBtn = btnContainer.createEl("button", {
      text: t("confirm.saveBtn"),
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => {
      resolve({ eval: includeEval, pins: includePins });
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
