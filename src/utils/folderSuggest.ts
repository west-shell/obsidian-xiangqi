import {
  type App,
  FuzzySuggestModal,
  Modal,
  normalizePath,
  Notice,
  Setting,
  type TFolder,
} from "obsidian";
import { t } from "../i18n";

/** A pickable row in the folder suggest: a real folder, or "New folder…". */
interface FolderEntry {
  folder: TFolder | null;
}

/**
 * Fuzzy folder picker over all vault folders — the same interaction as
 * Obsidian's native folder pickers, plus a trailing "New folder…" entry
 * that creates a folder on the fly. Resolves with the chosen
 * vault-relative folder path ("" for the vault root).
 */
export class FolderSuggestModal extends FuzzySuggestModal<FolderEntry> {
  constructor(
    app: App,
    private readonly onChooseFolder: (folder: string) => void,
  ) {
    super(app);
    this.setPlaceholder(t("export.chooseFolder"));
  }

  getItems(): FolderEntry[] {
    const entries = this.app.vault
      .getAllFolders(true)
      .map((folder: TFolder) => ({ folder }));
    // Appended last so the plain keyboard flow (open → Enter) still picks
    // the first real folder instead of the create entry.
    return [...entries, { folder: null }];
  }

  getItemText(item: FolderEntry): string {
    if (!item.folder) return `+ ${t("export.newFolder")}`;
    return item.folder.path === "" ? t("export.rootFolder") : item.folder.path;
  }

  onChooseItem(item: FolderEntry): void {
    if (!item.folder) {
      new NewFolderModal(this.app, this.onChooseFolder).open();
      return;
    }
    this.onChooseFolder(item.folder.path);
  }
}

/**
 * Prompts for a vault-relative folder path, creates it (and any missing
 * parents), then hands the normalized path to the callback.
 */
class NewFolderModal extends Modal {
  constructor(
    app: App,
    private readonly onCreateFolder: (folder: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t("export.newFolder.title"));

    let value = "";
    new Setting(this.contentEl)
      .setName(t("export.newFolder.name"))
      .setDesc(t("export.newFolder.desc"))
      .addText((text) => {
        text.setPlaceholder(t("export.newFolder.placeholder"));
        text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void this.submit(text.getValue());
          }
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
        text.onChange((v) => {
          value = v;
        });
      });

    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setCta()
          .setButtonText(t("export.newFolder.create"))
          .onClick(() => void this.submit(value)),
      )
      .addButton((button) =>
        button.setButtonText(t("confirm.cancel")).onClick(() => this.close()),
      );
  }

  private async submit(raw: string): Promise<void> {
    const folder = normalizeFolderPath(raw);
    if (!folder || folder.includes("?") || folder.includes("*")) {
      new Notice(t("export.invalidPath"));
      return;
    }
    if (this.app.vault.getFolderByPath(folder)) {
      this.close();
      this.onCreateFolder(folder);
      return;
    }
    try {
      await ensureFolders(this.app, folder);
    } catch {
      new Notice(t("export.newFolder.failed"));
      return;
    }
    this.close();
    this.onCreateFolder(folder);
  }
}

/** Normalizes a user-typed vault folder path ("" on empty, no leading "/"). */
export function normalizeFolderPath(value: string): string {
  let folder = normalizePath(value.trim());
  if (folder.startsWith("/")) folder = folder.slice(1);
  return folder;
}

/** Creates each missing folder along a vault-relative directory path. */
export async function ensureFolders(app: App, dir: string): Promise<void> {
  if (!dir || app.vault.getFolderByPath(dir)) return;
  let current = "";
  for (const part of dir.split("/")) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getFolderByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}
