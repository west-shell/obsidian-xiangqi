import "../Source/Source";

import { MarkdownView, Notice } from "obsidian";

import { registerBlockModule } from "../../core/module-system";
import type { IBlockHost } from "../../types";
import { DEFAULT_FEN } from "../../types";
import { promptSaveEval } from "../../utils/saveEval";
import { t } from "../../i18n";

const BlockHostModule = {
  init(host: IBlockHost) {
    const eventBus = host.eventBus;

    eventBus.on("full", () => {
      host.fen = DEFAULT_FEN;
    });

    eventBus.on("save", async () => {
      if (host.isFenMode) {
        const view =
          host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return;
        const fen = host.fen;
        const saveBlockName = host.settings.fenSaveBlockName;
        const newContent = `[FEN "${fen}"]`;

        void host.plugin.app.vault.process(view.file, (fileContent) => {
          const section = host.ctx.getSectionInfo(host.containerEl);
          if (!section) return fileContent;

          const { lineStart, lineEnd } = section;
          const lines = fileContent.split("\n");
          const firstLine = lines[lineStart];
          const newFirstLine = firstLine.replace(
            /^```\S+/,
            "```" + saveBlockName,
          );
          const updated = [newFirstLine, newContent, lines[lineEnd]];
          const newLines = [
            ...lines.slice(0, lineStart),
            ...updated,
            ...lines.slice(lineEnd + 1),
          ];
          return newLines.join("\n");
        });
        new Notice(t("notice.fenSaved"));
        return;
      }

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

    eventBus.on("reset", () => {
      eventBus.emit("load", "tree");
    });
  },
};

registerBlockModule("blockHost", BlockHostModule);
