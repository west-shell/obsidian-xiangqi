import { Modal, Setting } from "obsidian";
import { mount, unmount } from "svelte";

import { registerPGNViewModule } from "../../core/module-system";
import Chess from "../../lib/Tree/Chess.svelte";
import type { ChessNode, IPGNViewHost } from "../../types";
import { PGNParser } from "../Source/parser";
import { t } from "../../i18n";

const TreeViewModule = {
  init(host: IPGNViewHost) {
    const eventBus = host.eventBus;

    eventBus.on("setViewData", () => {
      host.markedPos = null;
      const parser = new PGNParser(host.data);
      host.parser = parser;
      host.haveFEN = parser.haveFEN;
      host.root = parser.getRoot();
      host.nodeMap = parser.getMap();
      host.tags = parser.getTags();
      host.currentNode = host.nodeMap.get("node-root")!;
      host.fen = host.currentNode.fen;
      host.currentTurn =
        host.currentNode.fen.split(" ")[1] === "b" ? "black" : "white";
      eventBus.emit("updateMainPath");
    });

    eventBus.on("createUI", () => {
      if (host.Chess) {
        void unmount(host.Chess);
        host.Chess = null;
      }
      const Container = host.contentEl;
      Container.classList.add("pgn-view");
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

    eventBus.on("updateUI", () => {
      host.Chess?.$set?.({
        settings: { ...host.settings },
        nodeMap: new Map(host.nodeMap),
        fen: host.currentNode?.fen ?? "",
        currentNode: host.currentNode,
        currentPath: host.currentPath,
      });
    });

    eventBus.on("ready", () => {
      if (!host.settings.autoJump) return;
      switch (host.settings.autoJump) {
        case "never":
          break;
        case "always":
          eventBus.emit("btn-click", "toEnd");
          break;
        case "auto":
          if (!host.haveFEN) eventBus.emit("btn-click", "toEnd");
          break;
      }
    });

    eventBus.on("reset", () => {
      eventBus.emit("setViewData");
      eventBus.emit("updateUI");
    });

    eventBus.on("save", async () => {
      const includeEval = await promptSaveEval(host);
      if (includeEval === null) return;

      const pgn = host.stringifyPGN(host.root, includeEval);
      const content = [host.tags?.trim(), pgn].filter(Boolean).join("\n");
      host.data = content;
      host.saveFile();
    });

    eventBus.on("unload", () => {
      if (host.Chess) void unmount(host.Chess);
    });
  },
};

registerPGNViewModule("Tree", TreeViewModule);

function hasEvalInTree(root: ChessNode): boolean {
  const stack: ChessNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.eval) return true;
    stack.push(...node.children);
  }
  return false;
}

async function promptSaveEval(host: IPGNViewHost): Promise<boolean | null> {
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
    modal.contentEl.empty();
  };
  modal.open();
  return promise;
}
