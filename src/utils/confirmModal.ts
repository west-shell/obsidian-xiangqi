import { type App, Modal, Setting } from 'obsidian';

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

/**
 * 保存选项弹窗：有分支时显示覆盖/更新，无分支时简单确认。
 */
export class SaveConfirmModal extends Modal {
  private resolvePromise: (value: 'overwrite' | 'update' | false) => void;
  public promise: Promise<'overwrite' | 'update' | false>;

  constructor(
    app: App,
    private hasBranches: boolean,
    private _t: (key: string) => string = k => k,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;
    const t = this._t;

    if (this.hasBranches) {
      // 有分支：显示覆盖 / 更新 两个选项
      new Setting(contentEl).setName(t('confirm.saveWithBranch')).setHeading();
      contentEl.createEl('p', { text: t('confirm.chooseMode') });

      const buttonContainer = contentEl.createDiv('modal-button-container');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.flexDirection = 'column';
      buttonContainer.style.gap = '8px';
      buttonContainer.style.marginTop = '12px';

      const makeBtn = (text: string, desc: string, value: 'overwrite' | 'update') => {
        const btn = buttonContainer.createEl('button', {
          cls: 'mod-cta',
        });
        btn.style.padding = '10px 16px';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `<strong>${text}</strong><br><span style="font-size:0.85em;opacity:0.7">${desc}</span>`;
        btn.addEventListener('click', () => {
          this.resolvePromise(value);
          this.close();
        });
      };

      makeBtn(t('confirm.overwrite'), t('confirm.overwrite.desc'), 'overwrite');
      makeBtn(t('confirm.update'), t('confirm.update.desc'), 'update');

      const cancelBtn = buttonContainer.createEl('button', {
        text: t('confirm.cancel'),
      });
      cancelBtn.style.marginTop = '4px';
      cancelBtn.addEventListener('click', () => {
        this.resolvePromise(false);
        this.close();
      });

      this.scope.register([], 'Escape', () => {
        this.resolvePromise(false);
        this.close();
      });
    } else {
      // 无分支：简单确认/取消
      new Setting(contentEl).setName(t('confirm.saveTitle')).setHeading();
      contentEl.createEl('p', { text: t('confirm.saveConfirm') });

      const buttonContainer = contentEl.createDiv('modal-button-container');

      const saveBtn = buttonContainer.createEl('button', {
        text: t('confirm.saveBtn'),
        cls: 'mod-cta',
      });
      saveBtn.addEventListener('click', () => {
        this.resolvePromise('overwrite');
        this.close();
      });

      const cancelBtn = buttonContainer.createEl('button', {
        text: t('confirm.cancel'),
      });
      cancelBtn.addEventListener('click', () => {
        this.resolvePromise(false);
        this.close();
      });

      saveBtn.focus();
      this.scope.register([], 'Enter', () => {
        this.resolvePromise('overwrite');
        this.close();
      });
      this.scope.register([], 'Escape', () => {
        this.resolvePromise(false);
        this.close();
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
