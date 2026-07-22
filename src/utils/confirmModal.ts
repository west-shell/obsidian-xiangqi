import { type App, Modal, Setting } from "obsidian";

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
  private progressBar!: HTMLProgressElement;
  private statusEl!: HTMLElement;
  public abortController: AbortController = new AbortController();

  constructor(
    app: App,
    private readonly fileName: string,
    private readonly downloadUrl: string,
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

    const fileLine = contentEl.createEl("p");
    fileLine.createSpan({ text: this.fileName });
    fileLine.appendText("（");
    const link = fileLine.createEl("a", {
      text: "GitHub",
      attr: { href: this.downloadUrl, target: "_blank" },
    });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(this.downloadUrl, "_blank");
    });
    fileLine.appendText("）");

    this.progressBar = contentEl.createEl("progress", {
      cls: "download-progress",
    });
    this.progressBar.value = 0;
    this.progressBar.style.width = "100%";
    this.progressBar.style.display = "none";

    this.statusEl = contentEl.createEl("p", {
      cls: "download-status",
      text: "",
    });

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

  showProgress() {
    this.progressBar.style.display = "block";
    const downloadBtn = this.contentEl.querySelector(
      "button.mod-cta",
    ) as HTMLButtonElement;
    if (downloadBtn) downloadBtn.disabled = true;
  }

  setProgress(loaded: number, total: number) {
    this.progressBar.value = loaded;
    this.progressBar.max = total;
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    this.statusEl.textContent = `${mb(loaded)} / ${mb(total)} MB`;
  }

  done() {
    this.statusEl.textContent = "✓";
    this.progressBar.value = this.progressBar.max;
    window.setTimeout(() => this.close(), 500);
  }

  error(msg: string) {
    this.statusEl.textContent = msg;
    const buttons = this.contentEl.querySelectorAll("button");
    buttons.forEach((b) => ((b).disabled = false));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
