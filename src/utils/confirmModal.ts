import { type App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

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
  private resolvePromise: (value: boolean) => void;
  public promise: Promise<boolean>;
  private readonly fileRows: {
    name: string;
    status: HTMLSpanElement;
    nameSpan: HTMLSpanElement;
  }[] = [];
  private downloadBtn!: HTMLButtonElement;
  private readonly selectedSourceKey: string;
  private sourceSelect!: HTMLSelectElement;

  constructor(
    app: App,
    private readonly title: string,
    private readonly files: DownloadFileSource[],
    private readonly confirmText: string,
    private readonly cancelText: string,
    private readonly sourceLabel: string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
    this.selectedSourceKey = files[0]?.sources[0]?.key ?? "github";
  }

  getSelectedSource(): string {
    return this.sourceSelect?.value ?? this.selectedSourceKey;
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
      this.resolvePromise(true);
    });

    const cancelBtn = btnContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.resolvePromise(false);
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
      this.retry(index);
    });
    this.downloadBtn.disabled = false;
  }

  private retry(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.status.empty();
    row.nameSpan.textContent = row.name;
    this.resolvePromise(true);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
