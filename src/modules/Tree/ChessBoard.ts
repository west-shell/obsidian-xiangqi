import { MarkdownView, Modal, Notice, Setting } from "obsidian";
import { mount, unmount } from "svelte";

import { registerTreeModule } from "../../core/module-system";
import Chess from "../../lib/Tree/Chess.svelte";
import type { ChessNode, ITreeHost } from "../../types";
import { t } from "../../i18n";

const BoardModule = {
  init(host: ITreeHost) {
    const eventBus = host.eventBus;

    eventBus.on("creatUI", () => {
      host.modified = false;
      const Container = host.containerEl.createDiv();
      host.Chess = mount(Chess, {
        target: Container,
        props: {
          nodeMap: host.nodeMap,
          settings: host.settings,
          fen: host.currentNode.fen,
          eventBus: host.eventBus,
          currentNode: host.currentNode,
          currentPath: host.currentPath,
          options: host.options || {},
        },
      });
    });

    eventBus.on("ready", () => {
      // autoJump 逻辑已移至 Source.ts 加载阶段
    });

    eventBus.on("updateUI", () => {
      host.Chess?.$set?.({
        settings: { ...host.settings },
        nodeMap: new Map(host.nodeMap),
        fen: host.currentNode.fen,
        currentNode: host.currentNode,
        currentPath: host.currentPath,
      });
    });

    eventBus.on("reset", () => {
      eventBus.emit("load", "tree");
      eventBus.emit("updateUI");
    });

    eventBus.on("save", async () => {
      const includeEval = await promptSaveEval(host);
      if (includeEval === null) return;

      const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) return;
      const pgn = host.stringifyPGN(host.root, includeEval);
      const newContent = [host.tags?.trim(), pgn].filter(Boolean).join("\n");

      void host.plugin.app.vault.process(view.file, (fileContent) => {
        const section = host.ctx.getSectionInfo(host.containerEl);
        if (!section) return fileContent;

        const { lineStart, lineEnd } = section;
        const lines = fileContent.split("\n");
        const blockLines = lines.slice(lineStart, lineEnd + 1);

        if (blockLines.length < 2) return fileContent;

        // 保留第一行（```tree）和最后一行（```），替换中间内容
        const updated = [
          blockLines[0],
          newContent,
          blockLines[blockLines.length - 1],
        ];
        const newLines = [
          ...lines.slice(0, lineStart),
          ...updated,
          ...lines.slice(lineEnd + 1),
        ];
        return newLines.join("\n");
      });
      new Notice(t("notice.saveSuccess"));
    });

    eventBus.on("unload", () => {
      if (host.Chess) void unmount(host.Chess);
    });
  },
};

registerTreeModule("board", BoardModule);

function hasEvalInTree(root: ChessNode): boolean {
  const stack: ChessNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.eval) return true;
    stack.push(...node.children);
  }
  return false;
}

async function promptSaveEval(host: ITreeHost): Promise<boolean | null> {
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
