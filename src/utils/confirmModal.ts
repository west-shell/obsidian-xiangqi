import { type App, Modal, Setting } from 'obsidian';

export class SaveConfirmModal extends Modal {
  private resolvePromise: (value: 'save' | 'saveAll' | 'cancel') => void;
  public promise: Promise<'save' | 'saveAll' | 'cancel'>;

  constructor(
    app: App,
    private hasBranches: boolean,
    private t: (key: string) => string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(this.t('confirm.saveTitle')).setHeading();

    if (this.hasBranches) {
      contentEl.createEl('p', { text: this.t('confirm.saveBranchesMsg') });

      const btnContainer = contentEl.createDiv('modal-button-container');

      const saveMainBtn = btnContainer.createEl('button', {
        text: this.t('confirm.saveMain'),
        cls: 'mod-cta',
      });
      saveMainBtn.addEventListener('click', () => {
        this.resolvePromise('save');
        this.close();
      });

      const saveAllBtn = btnContainer.createEl('button', {
        text: this.t('confirm.saveAll'),
      });
      saveAllBtn.addEventListener('click', () => {
        this.resolvePromise('saveAll');
        this.close();
      });

      const cancelBtn = btnContainer.createEl('button', {
        text: this.t('confirm.cancel'),
      });
      cancelBtn.addEventListener('click', () => {
        this.resolvePromise('cancel');
        this.close();
      });
    } else {
      contentEl.createEl('p', { text: this.t('confirm.saveMsg') });

      const btnContainer = contentEl.createDiv('modal-button-container');

      const confirmBtn = btnContainer.createEl('button', {
        text: this.t('confirm.saveBtn'),
        cls: 'mod-cta',
      });
      confirmBtn.addEventListener('click', () => {
        this.resolvePromise('save');
        this.close();
      });

      const cancelBtn = btnContainer.createEl('button', {
        text: this.t('confirm.cancel'),
      });
      cancelBtn.addEventListener('click', () => {
        this.resolvePromise('cancel');
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
    private title: string,
    private message: string,
    private confirmText = '确认',
    private cancelText = '取消',
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName(this.title).setHeading();

    contentEl.createEl('p', { text: this.message });

    const buttonContainer = contentEl.createDiv('modal-button-container');

    const confirmBtn = buttonContainer.createEl('button', {
      text: this.confirmText,
      cls: 'mod-cta',
    });
    confirmBtn.addEventListener('click', () => {
      this.resolvePromise(true);
      this.close();
    });

    const cancelBtn = buttonContainer.createEl('button', {
      text: this.cancelText,
    });
    cancelBtn.addEventListener('click', () => {
      this.resolvePromise(false);
      this.close();
    });

    confirmBtn.focus();
    this.scope.register([], 'Enter', () => {
      this.resolvePromise(true);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
