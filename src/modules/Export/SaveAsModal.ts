import { type App, Modal, normalizePath, Notice, Setting } from "obsidian";
import { CLS_PREFIX } from "../../chess";
import { t } from "../../i18n";
import { ConfirmModal } from "../../utils/confirmModal";
import {
  ensureFolders,
  FolderSuggestModal,
  normalizeFolderPath,
} from "../../utils/folderSuggest";
import type { ExportArtifact } from "./exportImage";

/**
 * Save-as dialog for a rendered export artifact. The save folder (a
 * read-only pill that opens the fuzzy folder picker) and the filename are
 * separate fields; both are prefilled from the default path derived from
 * the configured export folder (or, when unset, the attachment settings).
 * Existing files trigger an overwrite confirmation; missing folders are
 * created on save.
 */
export class SaveAsModal extends Modal {
  private saving = false;

  constructor(
    app: App,
    private readonly artifact: ExportArtifact,
    private readonly defaultPath: string,
    private readonly savedMessage: string,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName(t("export.saveAs")).setHeading();

    // Split the default path into the two fields.
    const slash = this.defaultPath.lastIndexOf("/");
    let defaultFolder = slash !== -1 ? this.defaultPath.slice(0, slash) : "";
    const defaultName =
      slash !== -1 ? this.defaultPath.slice(slash + 1) : this.defaultPath;

    const folderRow = contentEl.createDiv(`${CLS_PREFIX}-export-path-row`);
    folderRow.createEl("label", { text: t("export.folder") });
    const folderValue = folderRow.createSpan({
      cls: `${CLS_PREFIX}-folder-value`,
      attr: {
        "aria-label": t("export.chooseFolder"),
        title: t("export.chooseFolder"),
      },
    });
    const refreshFolder = (): void => {
      folderValue.setText(defaultFolder || "/");
    };
    refreshFolder();
    folderValue.addEventListener("click", () => {
      new FolderSuggestModal(this.app, (folder) => {
        defaultFolder = folder;
        refreshFolder();
      }).open();
    });

    const nameRow = contentEl.createDiv(`${CLS_PREFIX}-export-path-row`);
    nameRow.createEl("label", { text: t("export.fileName") });
    const nameInput = nameRow.createEl("input", {
      attr: { type: "text", value: defaultName },
    });
    nameInput.select();

    const submit = (): void => {
      void this.handleSave(defaultFolder, nameInput.value);
    };
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });

    const btnContainer = contentEl.createDiv("modal-button-container");
    const saveBtn = btnContainer.createEl("button", {
      text: t("export.save"),
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", submit);
    const cancelBtn = btnContainer.createEl("button", {
      text: t("confirm.cancel"),
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  private async handleSave(
    folderValue: string,
    nameValue: string,
  ): Promise<void> {
    if (this.saving) return;
    const folder = normalizeFolderPath(folderValue);
    let name = normalizePath(nameValue.trim());
    if (!name || name.includes("/")) {
      new Notice(t("export.invalidPath"));
      return;
    }
    // Force the artifact's extension so the file type matches the content:
    // append it when missing, replace it when a different one was typed.
    const ext = this.artifact.filename.slice(
      this.artifact.filename.lastIndexOf("."),
    );
    if (!name.toLowerCase().endsWith(ext)) {
      const dot = name.lastIndexOf(".");
      name = (dot > 0 ? name.slice(0, dot) : name) + ext;
    }
    const path = folder ? `${folder}/${name}` : name;

    this.saving = true;
    try {
      const existing = this.app.vault.getFileByPath(path);
      if (existing) {
        const overwrite = await new ConfirmModal(
          this.app,
          t("export.saveAs"),
          t("export.fileExists"),
          t("confirm.saveBtn"),
          t("confirm.cancel"),
        ).promise;
        if (!overwrite) return;
        await this.app.vault.modifyBinary(existing, this.artifact.data);
      } else {
        if (folder) {
          await ensureFolders(this.app, folder);
        }
        await this.app.vault.createBinary(path, this.artifact.data);
      }
      new Notice(`${this.savedMessage}: ${path}`);
      this.close();
    } catch (error) {
      console.error(error);
      new Notice(t("export.exportFailed"));
    } finally {
      this.saving = false;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
