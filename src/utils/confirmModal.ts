import { type App, Modal, Notice, Setting } from "obsidian";
import { t } from "../i18n";
import type { ChessNode, GameSlot, IHost } from "../types";
import { PGNParser } from "../modules/Source/parser";
import { validateFen } from "./chessEngine";
import { activateGame } from "./parse";
import { CLS_PREFIX, DEFAULT_FEN, PGN_PLACEHOLDER } from "../chess";

export type SaveConfirmResult = {
  action: "save" | "saveAll" | "cancel";
  includeEval: boolean;
};

export class SaveConfirmModal extends Modal {
  private resolvePromise: (value: SaveConfirmResult) => void;
  public promise: Promise<SaveConfirmResult>;
  private includeEval = true;

  constructor(
    app: App,
    private readonly hasBranches: boolean,
    private readonly hasEval: boolean,
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

    if (this.hasEval) {
      new Setting(contentEl)
        .setName(this.t("confirm.saveEval"))
        .addToggle((toggle) => {
          toggle.setValue(this.includeEval).onChange((val) => {
            this.includeEval = val;
          });
        });
    }

    if (this.hasBranches) {
      contentEl.createEl("p", { text: this.t("confirm.saveBranchesMsg") });

      const btnContainer = contentEl.createDiv("modal-button-container");

      const saveMainBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveMain"),
        cls: "mod-cta",
      });
      saveMainBtn.addEventListener("click", () => {
        this.resolvePromise({ action: "save", includeEval: this.includeEval });
        this.close();
      });

      const saveAllBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveAll"),
      });
      saveAllBtn.addEventListener("click", () => {
        this.resolvePromise({
          action: "saveAll",
          includeEval: this.includeEval,
        });
        this.close();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: this.t("confirm.cancel"),
      });
      cancelBtn.addEventListener("click", () => {
        this.resolvePromise({
          action: "cancel",
          includeEval: this.includeEval,
        });
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
        this.resolvePromise({ action: "save", includeEval: this.includeEval });
        this.close();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: this.t("confirm.cancel"),
      });
      cancelBtn.addEventListener("click", () => {
        this.resolvePromise({
          action: "cancel",
          includeEval: this.includeEval,
        });
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
  public promise: Promise<boolean>;

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

    // 标题
    new Setting(contentEl).setName(this.title).setHeading();

    // 消息内容
    contentEl.createEl("p", { text: this.message });

    // 按钮容器
    const buttonContainer = contentEl.createDiv("modal-button-container");

    // 确认按钮（使用 Obsidian 的主色调样式）
    const confirmBtn = buttonContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta", // Obsidian 的强调按钮样式
    });
    confirmBtn.addEventListener("click", () => {
      this.resolvePromise(true);
      this.close();
    });

    // 取消按钮
    const cancelBtn = buttonContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.resolvePromise(false);
      this.close();
    });

    // 回车键确认，ESC 键取消
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
    private readonly isBlockMode = false,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName(t("import.title")).setHeading();

    new Setting(contentEl).setName(t("import.fen"));
    const fenArea = contentEl.createEl("textarea", {
      cls: `${CLS_PREFIX}-modal-textarea`,
      attr: {
        rows: "3",
        placeholder: DEFAULT_FEN,
      },
    });
    fenArea.addEventListener("input", () => {
      this.fenValue = fenArea.value;
    });

    contentEl.createDiv({
      cls: `${CLS_PREFIX}-modal-warning`,
      text: t("import.fenWarning"),
    });

    const fenBtnContainer = contentEl.createDiv("modal-button-container");
    const importFenBtn = fenBtnContainer.createEl("button", {
      text: t("import.importFen"),
      cls: "mod-cta",
    });
    importFenBtn.addEventListener("click", () => this.handleImportFen());

    contentEl.createDiv({ cls: `${CLS_PREFIX}-modal-separator` });

    new Setting(contentEl).setName(t("import.pgn"));
    const pgnArea = contentEl.createEl("textarea", {
      cls: `${CLS_PREFIX}-modal-textarea`,
      attr: { rows: "6", placeholder: PGN_PLACEHOLDER },
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
    if (!this.isBlockMode) {
      const addGameBtn = pgnBtnContainer.createEl("button", {
        text: t("import.addGame"),
      });
      addGameBtn.addEventListener("click", () => this.handleImportPgn("game"));
    }

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

  private handleImportPgn(mode: "overwrite" | "branch" | "game") {
    const pgn = this.pgnValue.trim();
    if (!pgn) {
      new Notice(t("import.emptyPgn"));
      return;
    }

    let parser: PGNParser;
    try {
      parser = new PGNParser(pgn, true);
    } catch {
      new Notice(t("import.invalidPgn"));
      return;
    }

    const host = this.host;
    const eventBus = host.eventBus;

    if (mode === "game") {
      const newSlot: GameSlot = {
        raw: pgn,
        headers: new Map(),
        parsed: {
          root: parser.getRoot(),
          nodeMap: parser.getMap(),
          tags: parser.getTags(),
          parser,
        },
      };
      host.games.push(newSlot);
      activateGame(host, host.games.length - 1);
      host.currentTurn =
        host.currentNode.move?.color === "b" ? "white" : "black";
      eventBus.emit("updateMainPath");
      eventBus.emit("updateUI");
      eventBus.emit("modified", null);
      this.close();
      new Notice(t("notice.pgnImportedAsGame"));
      return;
    }

    const newRoot = parser.getRoot();
    const newMap = parser.getMap();
    const newTags = parser.getTags();

    if (mode === "overwrite") {
      host.parser = parser;
      host.root = newRoot;
      host.nodeMap = newMap;
      host.tags = newTags;
    } else {
      if (newRoot.fen !== host.root.fen) {
        new Notice(t("import.fenMismatch"));
        return;
      }
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
    host.currentTurn = host.currentNode.move?.color === "b" ? "white" : "black";

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
  private fenMode: "current" | "root" = "current";
  private pgnMode: "branch" | "all" | "allGames" = "branch";
  private fenArea!: HTMLTextAreaElement;
  private pgnArea!: HTMLTextAreaElement;

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
    this.fenArea = this.createExportArea(contentEl, this.buildFen());

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
    this.pgnArea = this.createExportArea(contentEl, this.buildPgn());

    const btnContainer = contentEl.createDiv("modal-button-container");
    const closeBtn = btnContainer.createEl("button", {
      text: t("export.close"),
    });
    closeBtn.addEventListener("click", () => this.close());
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
    return area;
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
