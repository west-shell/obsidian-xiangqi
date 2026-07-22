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

export class DownloadModal extends Modal {
  private resolvePromise: (value: boolean) => void;
  public promise: Promise<boolean>;
  private readonly fileRows: {
    name: string;
    url: string;
    bar: HTMLProgressElement;
    status: HTMLSpanElement;
    nameSpan: HTMLSpanElement;
  }[] = [];
  public abortController: AbortController = new AbortController();

  constructor(
    app: App,
    private readonly title: string,
    private readonly files: { name: string; url: string }[],
    private readonly confirmText: string,
    private readonly cancelText: string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("p", { text: this.title });

    for (const file of this.files) {
      const row = contentEl.createEl("p");

      const nameSpan = row.createSpan({ text: file.name });
      row.appendText("（");
      const link = row.createEl("a", {
        text: "GitHub",
        attr: { href: file.url, target: "_blank" },
      });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(file.url, "_blank");
      });
      row.appendText("）");

      const bar = contentEl.createEl("progress", { cls: "download-progress" });
      bar.value = 0;
      bar.setCssProps({ width: "100%", display: "none" });

      const status = contentEl.createSpan({ cls: "download-status", text: "" });

      this.fileRows.push({
        name: file.name,
        url: file.url,
        bar,
        status,
        nameSpan,
      });
    }

    const btnContainer = contentEl.createDiv("modal-button-container");

    const downloadBtn = btnContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta",
    });
    downloadBtn.addEventListener("click", () => {
      this.resolvePromise(true);
    });

    const cancelBtn = btnContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.abortController.abort();
      this.resolvePromise(false);
      this.close();
    });
  }

  showProgress(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.bar.setCssProps({ display: "block" });
    const downloadBtn = this.contentEl.querySelector(
      "button.mod-cta",
    ) as HTMLButtonElement;
    if (downloadBtn) downloadBtn.disabled = true;
  }

  setProgress(index: number, loaded: number, total: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.bar.value = loaded;
    row.bar.max = total;
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    row.status.textContent = `${mb(loaded)} / ${mb(total)} MB`;
  }

  done(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.nameSpan.textContent = row.name + " ✓";
    row.bar.setCssProps({ display: "none" });
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
    row.bar.setCssProps({ display: "none" });
    const buttons = this.contentEl.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = false));
  }

  private retry(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.status.empty();
    row.nameSpan.textContent = row.name;
    row.bar.setCssProps({ display: "block" });
    this.resolvePromise(true);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
