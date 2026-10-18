import { registerBlockModule } from "../core/module-system";
import type { IBlockHost } from "../types";

const CTRL_ACTION_BY_KEY: Record<string, string> = {
  ArrowUp: "navPrevFork",
  ArrowDown: "navNextFork",
  ArrowLeft: "prevPathBranch",
  ArrowRight: "nextPathBranch",
};

const CTRL_ALT_ACTION_BY_KEY: Record<string, string> = {
  ArrowLeft: "prevAllBranches",
  ArrowRight: "nextAllBranches",
};

const ALT_ACTION_BY_KEY: Record<string, string> = {
  ArrowLeft: "prevSamePly",
  ArrowRight: "nextSamePly",
};

const ALT_SHIFT_ACTION_BY_KEY: Record<string, string> = {
  ArrowLeft: "prevBranchEnd",
  ArrowRight: "nextBranchEnd",
};

/**
 * Ctrl/Alt(+Shift)+arrow branch navigation for chess blocks in
 * markdown. Blocks have no Obsidian Scope (unlike the PGN file view),
 * so each block listens on its own document and only reacts while the
 * pointer hovers the block and no editable element
 * (textarea/input/CodeMirror editor) has focus.
 */
const KeyboardNavModule = {
  init(host: IBlockHost) {
    const container = host.containerEl;
    const doc = container.ownerDocument;

    const isEditable = (el: Element | null): boolean => {
      return (
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        (el?.closest(".cm-editor") ?? null) !== null
      );
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey) return;
      let table: Record<string, string> | undefined;
      if (e.ctrlKey) {
        if (!e.shiftKey) {
          table = e.altKey ? CTRL_ALT_ACTION_BY_KEY : CTRL_ACTION_BY_KEY;
        }
      } else if (e.altKey) {
        table = e.shiftKey ? ALT_SHIFT_ACTION_BY_KEY : ALT_ACTION_BY_KEY;
      }
      const action = table?.[e.key];
      if (!action) return;
      if (isEditable(doc.activeElement)) return;
      if (!container.matches(":hover")) return;
      e.preventDefault();
      host.eventBus.emit("btn-click", { name: action });
    };

    doc.addEventListener("keydown", onKeyDown);
    host.eventBus.on("unload", () => {
      doc.removeEventListener("keydown", onKeyDown);
    });
  },
};

registerBlockModule("keyboardNav", KeyboardNavModule);
