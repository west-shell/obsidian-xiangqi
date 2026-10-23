import { type App, Modal, Notice } from "obsidian";
import { CLS_PREFIX } from "../../chess";
import { t } from "../../i18n";
import type { IHost } from "../../types";
import { normalizeFolderPath } from "../../utils/folderSuggest";
import { SaveAsModal } from "./SaveAsModal";
import {
  collectMainlineFens,
  collectPathFens,
  EXPORT_GIF_SIZE,
  EXPORT_PNG_SIZE,
  type ExportArtifact,
  exportBoardPng,
  exportGameGif,
} from "./exportImage";
export class ExportModal extends Modal {
  private includeComments = true;
  private includeEval = true;
  private fenMode: "current" | "root" = "current";
  private pgnMode: "branch" | "all" | "allGames" = "branch";
  private fenArea!: HTMLTextAreaElement;
  private pgnArea!: HTMLTextAreaElement;
  private gifIntervalInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly host: IHost,
    private readonly getCurrentBranchPGN: (
      includeComments: boolean,
      includeEval: boolean,
    ) => string,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    const host = this.host;

    contentEl.createDiv({
      text: t("export.fen"),
      cls: `${CLS_PREFIX}-export-section-title`,
    });
    this.createSegmented(
      contentEl,
      [
        { key: "current", label: t("export.currentFen") },
        { key: "root", label: t("export.rootFen") },
      ],
      this.fenMode,
      (key) => {
        this.fenMode = key as "current" | "root";
        this.setAreaValue(this.fenArea, this.buildFen());
      },
    );
    this.fenArea = this.createExportArea(contentEl, this.buildFen(), (row) => {
      const imageBtn = row.createEl("button", {
        text: t("export.exportImage"),
      });
      imageBtn.addEventListener("click", () => {
        void this.handleExportImage(imageBtn);
      });
    });

    contentEl.createDiv({
      text: t("export.pgn"),
      cls: `${CLS_PREFIX}-export-section-title ${CLS_PREFIX}-export-section-title--divider`,
    });
    const togglesRow = contentEl.createDiv(`${CLS_PREFIX}-export-toggles`);
    this.createToggle(
      togglesRow,
      t("export.includeComments"),
      () => {
        this.includeComments = !this.includeComments;
        this.setAreaValue(this.pgnArea, this.buildPgn());
      },
      this.includeComments,
    );
    this.createToggle(
      togglesRow,
      t("export.includeEval"),
      () => {
        this.includeEval = !this.includeEval;
        this.setAreaValue(this.pgnArea, this.buildPgn());
      },
      this.includeEval,
    );

    const pgnOptions: { key: string; label: string }[] = [
      { key: "branch", label: t("export.currentBranchPgn") },
      { key: "all", label: t("export.allPgn") },
    ];
    if (host.games && host.games.length > 1) {
      pgnOptions.push({ key: "allGames", label: t("export.allGames") });
    }
    this.createSegmented(contentEl, pgnOptions, this.pgnMode, (key) => {
      this.pgnMode = key as "branch" | "all" | "allGames";
      this.setAreaValue(this.pgnArea, this.buildPgn());
    });
    this.pgnArea = this.createExportArea(contentEl, this.buildPgn(), (row) => {
      const intervalLabel = row.createEl("label", {
        cls: `${CLS_PREFIX}-export-gif-interval`,
      });
      this.gifIntervalInput = intervalLabel.createEl("input", {
        attr: {
          type: "number",
          min: "0.1",
          max: "10",
          step: "0.1",
          value: "1",
        },
      });
      intervalLabel.appendText(t("export.gifIntervalUnit"));
      const gifBtn = row.createEl("button", { text: t("export.exportGif") });
      gifBtn.addEventListener("click", () => {
        void this.handleExportGif(gifBtn);
      });
    });

    const btnContainer = contentEl.createDiv("modal-button-container");
    const closeBtn = btnContainer.createEl("button", {
      text: t("export.close"),
    });
    closeBtn.addEventListener("click", () => this.close());
  }

  private async handleExportImage(button: HTMLButtonElement): Promise<void> {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = t("export.exporting");
    try {
      const artifact = await exportBoardPng({
        fen: this.buildFen(),
        size: EXPORT_PNG_SIZE,
        coordinates: this.host.settings.showCoordinateLabels,
      });
      await this.promptSaveAs(artifact, t("export.imageSaved"));
    } catch (error) {
      console.error(error);
      new Notice(t("export.exportFailed"));
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  private async handleExportGif(button: HTMLButtonElement): Promise<void> {
    const fens = this.collectGifFens();
    if (fens.length === 0) {
      new Notice(t("export.exportFailed"));
      return;
    }
    const label = button.textContent;
    button.disabled = true;
    try {
      const artifact = await exportGameGif({
        fens,
        intervalMs: this.readGifIntervalMs(),
        size: EXPORT_GIF_SIZE,
        coordinates: this.host.settings.showCoordinateLabels,
        onProgress: (done, total) => {
          button.textContent = `${t("export.exporting")} ${done}/${total}`;
        },
      });
      await this.promptSaveAs(artifact, t("export.gifSaved"));
    } catch (error) {
      console.error(error);
      new Notice(t("export.exportFailed"));
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  /**
   * Opens the save-as dialog for a rendered artifact, prefilled with the
   * configured export folder (or, when unset, the default path from the
   * user's attachment settings).
   */
  private async promptSaveAs(
    artifact: ExportArtifact,
    savedMessage: string,
  ): Promise<void> {
    try {
      const configured = normalizeFolderPath(this.host.settings.exportFolder);
      const defaultPath = configured
        ? `${configured}/${artifact.filename}`
        : await this.app.fileManager.getAvailablePathForAttachment(
            artifact.filename,
          );
      new SaveAsModal(this.app, artifact, defaultPath, savedMessage).open();
    } catch (error) {
      console.error(error);
      new Notice(t("export.exportFailed"));
    }
  }

  private readGifIntervalMs(): number {
    const seconds = Number(this.gifIntervalInput.value);
    const clamped = Number.isFinite(seconds)
      ? Math.min(Math.max(seconds, 0.1), 10)
      : 1;
    return Math.round(clamped * 1000);
  }

  /** FENs to animate, following the selected PGN scope. */
  private collectGifFens(): string[] {
    const host = this.host;
    if (this.pgnMode === "allGames") {
      const fens: string[] = [];
      for (const slot of host.games) {
        if (slot.parsed) fens.push(...collectMainlineFens(slot.parsed.root));
      }
      return fens;
    }
    if (this.pgnMode === "branch") return collectPathFens(host);
    return collectMainlineFens(host.root);
  }

  private createToggle(
    container: HTMLElement,
    label: string,
    onChange: () => void,
    checked: boolean,
  ) {
    const wrap = container.createEl("label", {
      cls: `${CLS_PREFIX}-export-toggle`,
    });
    const input = wrap.createEl("input", { attr: { type: "checkbox" } });
    input.checked = checked;
    input.addEventListener("change", onChange);
    wrap.appendText(label);
  }

  private buildFen(): string {
    const host = this.host;
    return this.fenMode === "root" ? host.root.fen : host.currentNode.fen;
  }

  private buildPgn(): string {
    const host = this.host;
    if (this.pgnMode === "allGames") return this.getAllGamesPGN();
    if (this.pgnMode === "all") {
      return (
        host.tags + "\n\n" + host.stringifyPGN(host.root, this.includeEval)
      );
    }
    return this.getCurrentBranchPGN(this.includeComments, this.includeEval);
  }

  private getAllGamesPGN(): string {
    const host = this.host;
    const parts: string[] = [];
    for (const slot of host.games) {
      if (slot.parsed) {
        const pgn = host.stringifyPGN(slot.parsed.root, this.includeEval);
        const content = [slot.parsed.tags?.trim(), pgn]
          .filter(Boolean)
          .join("\n");
        parts.push(content);
      } else {
        parts.push(slot.raw.trim());
      }
    }
    return parts.join("\n\n");
  }

  private setAreaValue(area: HTMLTextAreaElement, value: string) {
    area.value = value;
    area.setAttribute(
      "rows",
      String(Math.max(2, Math.min(value.split("\n").length, 10))),
    );
  }

  private createSegmented(
    container: HTMLElement,
    options: { key: string; label: string }[],
    activeKey: string,
    onChange: (key: string) => void,
  ) {
    const group = container.createDiv(`${CLS_PREFIX}-export-segmented`);
    const buttons = new Map<string, HTMLButtonElement>();
    for (const opt of options) {
      const btn = group.createEl("button", { text: opt.label });
      buttons.set(opt.key, btn);
      btn.addEventListener("click", () => {
        for (const [key, b] of buttons) {
          b.classList.toggle("mod-cta", key === opt.key);
        }
        onChange(opt.key);
      });
    }
    buttons.get(activeKey)?.classList.add("mod-cta");
  }

  private createExportArea(
    container: HTMLElement,
    value: string,
    addExtraButtons?: (row: HTMLElement) => void,
  ): HTMLTextAreaElement {
    const area = container.createEl("textarea", {
      cls: `${CLS_PREFIX}-modal-textarea ${CLS_PREFIX}-modal-textarea--fixed`,
      attr: {
        rows: String(Math.max(2, Math.min(value.split("\n").length, 10))),
        readonly: "",
      },
    });
    area.value = value;

    const copyRow = container.createDiv(`${CLS_PREFIX}-export-copy-row`);
    const copyBtn = copyRow.createEl("button", {
      text: t("export.copy"),
      cls: "mod-cta",
    });
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard
        .writeText(area.value)
        .then(() => {
          new Notice(t("notice.fenCopied"));
          return undefined;
        })
        .catch(() => {});
    });
    addExtraButtons?.(copyRow);
    return area;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
