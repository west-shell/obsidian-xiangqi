import { MarkdownView, Notice } from "obsidian";

import { registerGenFENModule } from "../../core/module-system";
import { t } from "../../i18n";
import type { IGenFENHost } from "../../types";
import { DEFAULT_FEN } from "../../types";

const ActionsModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on<string>("clickPieceBTN", (piece) => {
      if (!piece) return;
      if (host.selectedPiece === piece) {
        host.selectedPiece = null;
      } else {
        host.selectedPiece = piece;
      }
      host.eventBus.emit("updateUI");
    });

    eventBus.on<string>("btn-click", (action) => {
      if (!action) return;
      switch (action) {
        case "turn": {
          const parts = host.fen.split(" ");
          // 确保至少有 turn 字段，避免空 fen 拼出非法值
          while (parts.length < 2) parts.push("w");
          parts[1] = parts[1] === "w" ? "b" : "w";
          host.fen = parts.join(" ");
          break;
        }
        case "empty":
          host.fen = "4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1";
          host.selectedPiece = null;
          break;
        case "full":
          host.fen = DEFAULT_FEN;
          host.selectedPiece = null;
          break;
        case "save":
          void onSaveBTNClick(host);
          break;
      }
      eventBus.emit("updateUI");
    });
  },
};

registerGenFENModule("actions", ActionsModule);

async function onSaveBTNClick(host: IGenFENHost) {
  const fen = host.fen;
  const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;
  const file = view.file;
  if (!file) return;

  void host.plugin.app.vault.process(file, (fileContent) => {
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return fileContent;
    const { lineStart, lineEnd } = section;
    const lines = fileContent.split("\n");
    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);
    if (blockLines.length < 2) return fileContent;
    blockLines[0] = blockLines[0].replace(
      /^```\S+\b.*$/,
      `\`\`\`${host.plugin.settings.genfenSaveType}`,
    );
    blockLines = [blockLines[0], `[FEN "${fen}"]`, "```"];
    const newContent = [
      ...lines.slice(0, lineStart),
      ...blockLines,
      ...lines.slice(lineEnd + 1),
    ].join("\n");
    return newContent;
  });
  new Notice(t("notice.fenSaved"));
}
