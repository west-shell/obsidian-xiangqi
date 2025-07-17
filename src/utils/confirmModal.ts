import { type App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
	private resolvePromise: (value: boolean) => void;
	public promise: Promise<boolean>;

	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmText = "确认",
		private cancelText = "取消",
	) {
		super(app);
		this.resolvePromise = () => { };
		this.promise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}

	onOpen() {
		const { contentEl } = this;

		// 标题
		contentEl.createEl("h2", { text: this.title });

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
