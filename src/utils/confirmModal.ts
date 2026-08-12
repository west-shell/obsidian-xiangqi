import { type App, Modal, Notice, Setting } from "obsidian";
import { t } from "../i18n";
import type { ChessNode, IHost } from "../types";
import { PGNParser } from "../modules/Source/parser";
import { validateFen } from "./chessEngine";
import { computeGlyph } from "./winningChances";

export class SaveConfirmModal extends Modal {
  private resolvePromise: (value: "save" | "saveAll" | "cancel") => void;
  public readonly promise: Promise<"save" | "saveAll" | "cancel">;

  constructor(
    app: App,
    private readonly hasBranches: boolean,
    private readonly t: (key: string) => string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(this.t("confirm.saveTitle")).setHeading();

    if (this.hasBranches) {
      contentEl.createEl("p", { text: this.t("confirm.saveBranchesMsg") });

      const btnContainer = contentEl.createDiv("modal-button-container");

      const saveMainBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveMain"),
        cls: "mod-cta",
      });
      saveMainBtn.addEventListener("click", () => {
        this.resolvePromise("save");
        this.close();
      });

      const saveAllBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveAll"),
      });
      saveAllBtn.addEventListener("click", () => {
        this.resolvePromise("saveAll");
        this.close();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: this.t("confirm.cancel"),
      });
      cancelBtn.addEventListener("click", () => {
        this.resolvePromise("cancel");
        this.close();
      });
    } else {
      contentEl.createEl("p", { text: this.t("confirm.saveMsg") });

      const btnContainer = contentEl.createDiv("modal-button-container");

      const confirmBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveBtn"),
        cls: "mod-cta",
      });
      confirmBtn.addEventListener("click", () => {
        this.resolvePromise("save");
        this.close();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: this.t("confirm.cancel"),
      });
      cancelBtn.addEventListener("click", () => {
        this.resolvePromise("cancel");
        this.close();
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ConfirmModal extends Modal {
  private resolvePromise: (value: boolean) => void;
  public readonly promise: Promise<boolean>;

  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly confirmText = "确认",
    private readonly cancelText = "取消",
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName(this.title).setHeading();

    contentEl.createEl("p", { text: this.message });

    const buttonContainer = contentEl.createDiv("modal-button-container");

    const confirmBtn = buttonContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta",
    });
    confirmBtn.addEventListener("click", () => {
      this.resolvePromise(true);
      this.close();
    });

    const cancelBtn = buttonContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.resolvePromise(false);
      this.close();
    });

    confirmBtn.focus();
    this.scope.register([], "Enter", () => {
      this.resolvePromise(true);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export interface DownloadFileSource {
  name: string;
  sources: { key: string; label: string; url: string }[];
}

export class DownloadModal extends Modal {
  private readonly fileRows: {
    name: string;
    status: HTMLSpanElement;
    nameSpan: HTMLSpanElement;
  }[] = [];
  private downloadBtn!: HTMLButtonElement;
  private readonly selectedSourceKey: string;
  private sourceSelect!: HTMLSelectElement;
  private onConfirm: (() => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor(
    app: App,
    private readonly title: string,
    private readonly files: DownloadFileSource[],
    private readonly confirmText: string,
    private readonly cancelText: string,
    private readonly sourceLabel: string,
  ) {
    super(app);
    this.selectedSourceKey = files[0]?.sources[0]?.key ?? "github";
  }

  getSelectedSource(): string {
    return this.sourceSelect?.value ?? this.selectedSourceKey;
  }

  setCallbacks(onConfirm: () => void, onCancel: () => void): void {
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("p", { text: this.title });

    const allSources = this.files[0]?.sources ?? [];
    if (allSources.length > 0) {
      const sourceRow = contentEl.createDiv({
        cls: "modal-download-source",
      });
      sourceRow.createSpan({ text: this.sourceLabel });
      this.sourceSelect = sourceRow.createEl("select");
      for (const src of allSources) {
        this.sourceSelect.createEl("option", {
          text: src.label,
          attr: { value: src.key },
        });
      }
    }

    for (const file of this.files) {
      const row = contentEl.createEl("p");

      const nameSpan = row.createSpan({ text: file.name });
      row.appendText("（");

      const updateLinks = () => {
        const selectedKey = this.sourceSelect?.value ?? this.selectedSourceKey;
        const currentSrc = file.sources.find((s) => s.key === selectedKey);
        const linkContainer = row.querySelector(".download-link-container");
        if (linkContainer) {
          const link = linkContainer.querySelector("a");
          if (link && currentSrc) {
            link.textContent = currentSrc.label;
            link.setAttribute("href", currentSrc.url);
          }
        }
      };

      const linkWrap = row.createSpan({ cls: "download-link-container" });
      const firstSrc = file.sources[0];
      const link = linkWrap.createEl("a", {
        text: firstSrc?.label ?? "Download",
        attr: { href: firstSrc?.url ?? "#", target: "_blank" },
      });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href && href !== "#") window.open(href, "_blank");
      });

      if (this.sourceSelect) {
        this.sourceSelect.addEventListener("change", updateLinks);
      }

      row.appendText("）");

      const status = row.createSpan({ cls: "download-status", text: "" });

      this.fileRows.push({
        name: file.name,
        status,
        nameSpan,
      });
    }

    const btnContainer = contentEl.createDiv("modal-button-container");

    this.downloadBtn = btnContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta",
    });
    this.downloadBtn.addEventListener("click", () => {
      this.onConfirm?.();
    });

    const cancelBtn = btnContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.onCancel?.();
      this.close();
    });
  }

  showProgress(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.status.textContent = "⏳";
    this.downloadBtn.disabled = true;
  }

  done(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.nameSpan.textContent = row.name + " ✓";
    row.status.textContent = "";
    const allDone = this.fileRows.every((r) =>
      r.nameSpan.textContent?.includes("✓"),
    );
    if (allDone) {
      window.setTimeout(() => this.close(), 500);
    }
  }

  error(index: number, msg: string) {
    const row = this.fileRows[index];
    if (!row) return;
    row.status.textContent = "";
    const retryLink = row.status.createEl("a", {
      text: msg + " - " + t("engine.retry", 0),
      attr: { href: "#", target: "_blank" },
    });
    retryLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.onConfirm?.();
    });
    this.downloadBtn.disabled = false;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ImportModal extends Modal {
  private fenValue = "";
  private pgnValue = "";

  constructor(
    app: App,
    private readonly host: IHost,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName(t("import.title")).setHeading();

    new Setting(contentEl).setName(t("import.fen"));
    const fenArea = contentEl.createEl("textarea", {
      cls: "import-textarea",
      attr: {
        rows: "3",
        placeholder:
          "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w",
      },
    });
    fenArea.addEventListener("input", () => {
      this.fenValue = fenArea.value;
    });

    contentEl.createDiv({
      cls: "import-fen-warning",
      text: t("import.fenWarning"),
    });

    const fenBtnContainer = contentEl.createDiv("modal-button-container");
    const importFenBtn = fenBtnContainer.createEl("button", {
      text: t("import.importFen"),
      cls: "mod-cta",
    });
    importFenBtn.addEventListener("click", () => this.handleImportFen());

    contentEl.createDiv({ cls: "import-separator" });

    new Setting(contentEl).setName(t("import.pgn"));
    const pgnArea = contentEl.createEl("textarea", {
      cls: "import-textarea",
      attr: { rows: "6", placeholder: "H2-E2 H8-E8 ..." },
    });
    pgnArea.addEventListener("input", () => {
      this.pgnValue = pgnArea.value;
    });

    const pgnBtnContainer = contentEl.createDiv("modal-button-container");
    const overwriteBtn = pgnBtnContainer.createEl("button", {
      text: t("import.overwrite"),
      cls: "mod-cta",
    });
    overwriteBtn.addEventListener("click", () =>
      this.handleImportPgn("overwrite"),
    );
    const addBranchBtn = pgnBtnContainer.createEl("button", {
      text: t("import.addBranch"),
    });
    addBranchBtn.addEventListener("click", () =>
      this.handleImportPgn("branch"),
    );

    const cancelContainer = contentEl.createDiv("modal-button-container");
    const cancelBtn = cancelContainer.createEl("button", {
      text: t("confirm.cancel"),
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  private handleImportFen() {
    const fen = this.fenValue.trim();
    if (!fen) {
      new Notice(t("import.emptyFen"));
      return;
    }
    const validation = validateFen(fen);
    if (!validation.ok) {
      new Notice(t("import.invalidFen"));
      return;
    }

    const host = this.host;
    const eventBus = host.eventBus;

    host.root.children = [];
    host.root.comments = [];
    host.root.fen = fen;
    host.nodeMap.clear();
    host.nodeMap.set(host.root.id, host.root);
    host.currentNode = host.root;
    host.fen = fen;
    host.tags = updateFenTag(host.tags, fen);
    host.selectedPiece = null;
    host.markedPos = null;

    eventBus.emit("updateMainPath");
    eventBus.emit("updateUI");
    eventBus.emit("modified", null);

    this.close();
    new Notice(t("notice.fenImported"));
  }

  private handleImportPgn(mode: "overwrite" | "branch") {
    const pgn = this.pgnValue.trim();
    if (!pgn) {
      new Notice(t("import.emptyPgn"));
      return;
    }

    let parser: PGNParser;
    try {
      parser = new PGNParser(pgn);
    } catch {
      new Notice(t("import.invalidPgn"));
      return;
    }

    const host = this.host;
    const eventBus = host.eventBus;
    const newRoot = parser.getRoot();
    const newMap = parser.getMap();
    const newTags = parser.getTags();

    if (mode === "overwrite") {
      host.parser = parser;
      host.root = newRoot;
      host.nodeMap = newMap;
      host.tags = newTags;
      host.haveFEN = parser.haveFEN;
      computeAllGlyphs(host);
    } else {
      function reassignIds(node: ChessNode, parentId: string | null) {
        const newId = `node-${host.parser.nodeId++}`;
        node.parentID = parentId;
        node.id = newId;
        host.nodeMap.set(newId, node);
        for (const child of node.children) {
          reassignIds(child, newId);
        }
      }
      for (const child of newRoot.children) {
        reassignIds(child, host.root.id);
        host.root.children.push(child);
      }
    }

    host.currentNode = host.nodeMap.get("node-root")!;
    host.fen = host.currentNode.fen;
    host.currentTurn = host.currentNode.move?.color === "w" ? "black" : "white";

    eventBus.emit("updateMainPath");
    eventBus.emit("updateUI");
    eventBus.emit("modified", null);

    this.close();
    new Notice(
      mode === "overwrite"
        ? t("notice.pgnImported")
        : t("notice.pgnImportedAsBranch"),
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ExportModal extends Modal {
  private includeComments = true;
  private includeEval = true;
  private allPgnArea!: HTMLTextAreaElement;
  private branchPgnArea!: HTMLTextAreaElement;

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

    new Setting(contentEl).setName(t("export.title")).setHeading();

    const rootFen = host.root.fen;
    const currentFen = host.currentNode.fen;

    this.addExportSection(contentEl, t("export.rootFen"), rootFen, null);
    this.addExportSection(contentEl, t("export.currentFen"), currentFen, null);

    new Setting(contentEl)
      .setName(t("export.includeComments"))
      .addToggle((toggle) => {
        toggle.setValue(this.includeComments).onChange((val) => {
          this.includeComments = val;
          this.refreshPgn();
        });
      });

    new Setting(contentEl)
      .setName(t("export.includeEval"))
      .addToggle((toggle) => {
        toggle.setValue(this.includeEval).onChange((val) => {
          this.includeEval = val;
          this.refreshPgn();
        });
      });

    const allPgn =
      host.tags + "\n\n" + host.stringifyPGN(host.root, this.includeEval);
    this.addExportSection(contentEl, t("export.allPgn"), allPgn, "allPgn");

    const branchPgn = this.getCurrentBranchPGN(
      this.includeComments,
      this.includeEval,
    );
    this.addExportSection(
      contentEl,
      t("export.currentBranchPgn"),
      branchPgn,
      "branchPgn",
    );

    const btnContainer = contentEl.createDiv("modal-button-container");
    const closeBtn = btnContainer.createEl("button", {
      text: t("export.close"),
    });
    closeBtn.addEventListener("click", () => this.close());
  }

  private refreshPgn() {
    const host = this.host;
    const allPgn =
      host.tags + "\n\n" + host.stringifyPGN(host.root, this.includeEval);
    if (this.allPgnArea) this.allPgnArea.value = allPgn;
    const branchPgn = this.getCurrentBranchPGN(
      this.includeComments,
      this.includeEval,
    );
    if (this.branchPgnArea) this.branchPgnArea.value = branchPgn;
  }

  private addExportSection(
    container: HTMLElement,
    label: string,
    value: string,
    areaKey: "allPgn" | "branchPgn" | null,
  ) {
    new Setting(container).setName(label);
    const area = container.createEl("textarea", {
      cls: "export-textarea",
      attr: {
        rows: String(Math.max(2, Math.min(value.split("\n").length, 10))),
        readonly: "",
      },
    });
    area.value = value;

    if (areaKey === "allPgn") this.allPgnArea = area;
    else if (areaKey === "branchPgn") this.branchPgnArea = area;

    const copyBtn = container.createEl("button", {
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
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

function updateFenTag(tags: string, newFen: string): string {
  if (tags.includes('[FEN "')) {
    return tags.replace(/\[FEN "[^"]*"\]/, `[FEN "${newFen}"]`);
  }
  return `[FEN "${newFen}"]\n${tags}`;
}

function computeAllGlyphs(host: IHost) {
  for (const [, node] of host.nodeMap) {
    if (!node.eval || !node.parentID) continue;
    const parent = host.nodeMap.get(node.parentID);
    node.glyph = computeGlyph(parent?.eval, node.eval, node.side);
  }
}
