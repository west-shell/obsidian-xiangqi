import { MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";

import { registerTreeModule } from "../../core/module-system";
import Chess from "../../lib/Tree/Chess.svelte";
import type { ITreeHost } from "../../types";

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
      host.Chess?.$set({
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

    eventBus.on("save", () => {
      const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) return;
      const pgn = host.stringifyPGN(host.root);
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
    });

    eventBus.on("unload", () => {
      void unmount(host.Chess);
    });
  },
};

registerTreeModule("board", BoardModule);
